using InsuranceClaims.Domain;

namespace InsuranceClaims.Services;

public sealed class ClaimService : IClaimService
{
    private readonly IClaimRepository _claims;
    private readonly IPolicyRepository _policies;
    private readonly IParticipationClient _participation;
    private readonly IClock _clock;

    public ClaimService(IClaimRepository claims, IPolicyRepository policies, IParticipationClient participation, IClock clock)
    {
        _claims = claims;
        _policies = policies;
        _participation = participation;
        _clock = clock;
    }

    public async Task<ClaimOperationResult> SaveDraftAsync(InsuranceClaim claim, CancellationToken cancellationToken)
    {
        if (await _policies.GetAsync(claim.PolicyId, claim.UserId, cancellationToken) is null)
            return ClaimOperationResult.Failure("A valid policy is required.");

        var contentError = ValidateContent(claim);
        if (contentError is not null)
            return ClaimOperationResult.Failure(contentError);

        claim.Status = ClaimStatus.Draft;
        claim.UpdatedAt = _clock.UtcNow;
        await _claims.SaveAsync(claim, cancellationToken);
        return ClaimOperationResult.Success();
    }

    public async Task<ClaimOperationResult> SubmitAsync(InsuranceClaim claim, CancellationToken cancellationToken)
    {
        if (claim.Status != ClaimStatus.Draft)
            return ClaimOperationResult.Failure("Only draft claims can be submitted.");

        var policy = await _policies.GetAsync(claim.PolicyId, claim.UserId, cancellationToken);
        if (policy is null)
            return ClaimOperationResult.Failure("A valid policy is required.");

        if (claim.IncidentDate > DateOnly.FromDateTime(_clock.UtcNow.UtcDateTime))
            return ClaimOperationResult.Failure("Incident date cannot be in the future.");

        if (claim.EstimatedAmount <= 0)
            return ClaimOperationResult.Failure("Estimated amount must be positive.");

        if (claim.EstimatedAmount > policy.CoverageLimit)
            return ClaimOperationResult.Failure("Estimated amount exceeds policy coverage.");

        if (string.IsNullOrWhiteSpace(claim.ClaimantName) || string.IsNullOrWhiteSpace(claim.Description))
            return ClaimOperationResult.Failure("Claimant and incident details are required.");

        var contentError = ValidateContent(claim);
        if (contentError is not null)
            return ClaimOperationResult.Failure(contentError);

        claim.Status = ClaimStatus.Submitted;
        claim.UpdatedAt = _clock.UtcNow;
        await _claims.SaveAsync(claim, cancellationToken);
        return ClaimOperationResult.Success();
    }

    private static string? ValidateContent(InsuranceClaim claim)
    {
        if (claim.ClaimantName.Length > 120 || claim.Description.Length > 2000 ||
            claim.Notes.Any(note => note.Body.Length > 2000 || string.IsNullOrWhiteSpace(note.Body)))
            return "Claim text exceeds the allowed length.";

        string[] allowedItems = ["Building", "Contents", "Temporary accommodation"];
        if (claim.AffectedItems.Any(item => !allowedItems.Contains(item, StringComparer.Ordinal)) ||
            claim.AffectedItems.Count != claim.AffectedItems.Distinct(StringComparer.Ordinal).Count())
            return "Affected items contain an unsupported or duplicate value.";

        return null;
    }

    public async Task<ClaimOperationResult> CreateParticipationAsync(InsuranceClaim claim, ClaimScenario scenario, CancellationToken cancellationToken)
    {
        if (claim.Status is not (ClaimStatus.Submitted or ClaimStatus.AwaitingParticipation))
            return ClaimOperationResult.Failure("Only submitted claims can request participation.");

        var participationResult = await _participation.RequestAsync(claim, ParticipationScenarioCatalog.Get(scenario), cancellationToken);
        if (!participationResult.IsSuccess || string.IsNullOrWhiteSpace(participationResult.RequestId))
            return ClaimOperationResult.Failure(participationResult.Error ?? "Could not create participation request.");

        claim.Status = ClaimStatus.AwaitingParticipation;
        claim.ParticipationRequestId = participationResult.RequestId;
        claim.ParticipationScenario = scenario;
        claim.UpdatedAt = _clock.UtcNow;
        await _claims.SaveAsync(claim, cancellationToken);
        return ClaimOperationResult.Success(participationResult.RequestId);
    }

    public async Task<ClaimOperationResult> ApplyAnswerAsync(InsuranceClaim claim, string selectedOption, string? value, CancellationToken cancellationToken)
    {
        if (claim.Status is ClaimStatus.ApprovedForNextStep or ClaimStatus.MoreInformationRequired or ClaimStatus.Escalated)
            return string.Equals(claim.SelectedOption, selectedOption, StringComparison.Ordinal)
                ? ClaimOperationResult.Success(claim.ParticipationRequestId)
                : ClaimOperationResult.Failure("Claim was already resolved with a different answer.");

        if (claim.Status != ClaimStatus.AwaitingParticipation)
            return ClaimOperationResult.Failure("Claim is not awaiting participation.");

        var allowed = ParticipationScenarioCatalog.Get(ClaimScenario.SelectDisposition).Options.Select(option => option.Key);
        if (!allowed.Contains(selectedOption, StringComparer.Ordinal))
            return ClaimOperationResult.Failure("Selected answer was not offered.");

        claim.SelectedOption = selectedOption;
        claim.Status = selectedOption switch
        {
            "continue" => ClaimStatus.ApprovedForNextStep,
            "more-information" => ClaimStatus.MoreInformationRequired,
            "escalate" => ClaimStatus.Escalated,
            _ => claim.Status
        };
        claim.UpdatedAt = _clock.UtcNow;
        await _claims.SaveAsync(claim, cancellationToken);
        return ClaimOperationResult.Success();
    }

    public async Task<ClaimOperationResult> RefreshParticipationAsync(InsuranceClaim claim, CancellationToken cancellationToken)
    {
        if (claim.Status is ClaimStatus.ApprovedForNextStep or ClaimStatus.MoreInformationRequired or ClaimStatus.Escalated or ClaimStatus.Expired)
            return ClaimOperationResult.Success(claim.ParticipationRequestId);

        if (claim.Status != ClaimStatus.AwaitingParticipation ||
            string.IsNullOrWhiteSpace(claim.ParticipationRequestId) ||
            claim.ParticipationScenario is null)
            return ClaimOperationResult.Failure("Claim has no participation request to refresh.");

        var status = await _participation.GetStatusAsync(claim.ParticipationRequestId, claim.UserId, cancellationToken);
        if (status.IsExpired)
        {
            claim.Status = ClaimStatus.Expired;
            claim.UpdatedAt = _clock.UtcNow;
            await _claims.SaveAsync(claim, cancellationToken);
            return ClaimOperationResult.Success(claim.ParticipationRequestId);
        }

        if (!status.IsResolved)
            return ClaimOperationResult.Success(claim.ParticipationRequestId);

        if (!status.IsAttestationValid)
            return ClaimOperationResult.Failure(
                $"Resolver attestation verification failed: {status.AttestationError ?? "unknown error"}");

        var applyResult = ApplyResolvedStatus(claim, status);
        if (!applyResult.IsSuccess)
            return applyResult;

        claim.SelectedOption = status.SelectedOption;
        claim.SelectedOptions = status.SelectedOptions;
        claim.AnswerValue = status.Value;
        claim.AttestationPayload = status.AttestationPayload;
        claim.UpdatedAt = _clock.UtcNow;
        await _claims.SaveAsync(claim, cancellationToken);
        return ClaimOperationResult.Success(claim.ParticipationRequestId);
    }

    private static ClaimOperationResult ApplyResolvedStatus(InsuranceClaim claim, ParticipationStatus status)
    {
        switch (claim.ParticipationScenario)
        {
            case ClaimScenario.SelectDisposition:
                var allowed = ParticipationScenarioCatalog.Get(ClaimScenario.SelectDisposition).Options.Select(option => option.Key);
                if (status.SelectedOption is null || !allowed.Contains(status.SelectedOption, StringComparer.Ordinal))
                    return ClaimOperationResult.Failure("Resolver returned an answer that was not offered.");
                claim.Status = status.SelectedOption switch
                {
                    "continue" => ClaimStatus.ApprovedForNextStep,
                    "more-information" => ClaimStatus.MoreInformationRequired,
                    "escalate" => ClaimStatus.Escalated,
                    _ => claim.Status
                };
                break;
            case ClaimScenario.AffectedItems:
                if (status.SelectedOptions is null || status.SelectedOptions.Count == 0)
                    return ClaimOperationResult.Failure("At least one affected item is required.");
                claim.Status = ClaimStatus.InReview;
                break;
            case ClaimScenario.ClaimantNote:
                if (string.IsNullOrWhiteSpace(status.Value))
                    return ClaimOperationResult.Failure("A claimant note is required.");
                claim.Status = ClaimStatus.MoreInformationRequired;
                break;
            case ClaimScenario.EstimatedAmount:
                if (!decimal.TryParse(status.Value, out var amount) || amount <= 0)
                    return ClaimOperationResult.Failure("A positive estimated amount is required.");
                claim.EstimatedAmount = amount;
                claim.Status = ClaimStatus.InReview;
                break;
            case ClaimScenario.IncidentDate:
                if (!DateOnly.TryParse(status.Value, out var incidentDate))
                    return ClaimOperationResult.Failure("A valid incident date is required.");
                claim.IncidentDate = incidentDate;
                claim.Status = ClaimStatus.InReview;
                break;
            case ClaimScenario.AdjusterAppointment:
                if (!DateTimeOffset.TryParse(status.Value, out _))
                    return ClaimOperationResult.Failure("A valid adjuster appointment is required.");
                claim.Status = ClaimStatus.InReview;
                break;
            case ClaimScenario.ClaimantDeclaration:
                if (!string.Equals(status.Value, "acknowledged", StringComparison.Ordinal))
                    return ClaimOperationResult.Failure("The claimant declaration was not acknowledged.");
                claim.Status = ClaimStatus.ApprovedForNextStep;
                break;
            default:
                return ClaimOperationResult.Failure("Claim participation scenario is not supported.");
        }

        return ClaimOperationResult.Success(claim.ParticipationRequestId);
    }
}
