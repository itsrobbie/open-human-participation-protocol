namespace InsuranceClaims.Domain;

public interface IClaimRepository
{
    Task<InsuranceClaim?> GetAsync(string id, string userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InsuranceClaim>> GetAllAsync(string userId, CancellationToken cancellationToken = default);
    Task SaveAsync(InsuranceClaim claim, CancellationToken cancellationToken = default);
}

public interface IPolicyRepository
{
    Task<InsurancePolicy?> GetAsync(string id, string userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InsurancePolicy>> GetAllAsync(string userId, CancellationToken cancellationToken = default);
}

public interface IParticipationClient
{
    Task<ParticipationRequestResult> RequestAsync(InsuranceClaim claim, ParticipationScenario scenario, CancellationToken cancellationToken = default);
    Task<ParticipationStatus> GetStatusAsync(string requestId, string userId, CancellationToken cancellationToken = default);
}

public sealed record ParticipationRequestResult(bool IsSuccess, string? RequestId = null, string? Error = null);

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed record ParticipationStatus(
    bool IsResolved,
    string? SelectedOption = null,
    IReadOnlyList<string>? SelectedOptions = null,
    string? Value = null,
    bool IsExpired = false,
    string? AttestationPayload = null,
    bool IsAttestationValid = true,
    string? AttestationError = null);

public interface IClaimService
{
    Task<ClaimOperationResult> SaveDraftAsync(InsuranceClaim claim, CancellationToken cancellationToken);
    Task<ClaimOperationResult> SubmitAsync(InsuranceClaim claim, CancellationToken cancellationToken);
    Task<ClaimOperationResult> CreateParticipationAsync(InsuranceClaim claim, ClaimScenario scenario, CancellationToken cancellationToken);
    Task<ClaimOperationResult> ApplyAnswerAsync(InsuranceClaim claim, string selectedOption, string? value, CancellationToken cancellationToken);
    Task<ClaimOperationResult> RefreshParticipationAsync(InsuranceClaim claim, CancellationToken cancellationToken);
}
