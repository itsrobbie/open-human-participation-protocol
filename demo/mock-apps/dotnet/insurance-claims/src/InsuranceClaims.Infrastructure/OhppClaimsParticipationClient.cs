using InsuranceClaims.Domain;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using System.Text.Json;

namespace InsuranceClaims.Infrastructure;

public sealed class OhppClaimsParticipationClient : IParticipationClient
{
    private readonly IOhppRequesterClient _client;
    private readonly string _resolverUrl;
    private readonly string _accessToken;
    private readonly string _appId;
    private readonly IInsuranceRegistrationStore _registrations;

    public OhppClaimsParticipationClient(IOhppRequesterClient client, IInsuranceRegistrationStore registrations, string resolverUrl, string accessToken, string appId)
    {
        _client = client;
        _resolverUrl = resolverUrl;
        _accessToken = accessToken;
        _appId = appId;
        _registrations = registrations;
    }

    public async Task<ParticipationRequestResult> RequestAsync(InsuranceClaim claim, ParticipationScenario scenario, CancellationToken cancellationToken = default)
    {
        var registration = await _registrations.GetForAppUserAsync(claim.UserId, cancellationToken);
        var resolverUrl = string.IsNullOrWhiteSpace(_resolverUrl)
            ? registration?.ResolverBaseUrl ?? string.Empty
            : _resolverUrl;
        var accessToken = registration?.AccessToken ?? _accessToken;
        var resolverUserId = registration?.UserId ?? claim.UserId;
        var request = new ParticipationRequestBuilder().ForUser(resolverUserId).FromApp(_appId)
            .WithSummary($"Insurance claim {claim.ClaimNumber}").WithDescription(scenario.Description)
            .WithCategory("insurance-claim").OfType(scenario.RequestType);
        if (scenario.RequestType is RequestType.Select or RequestType.Multiselect)
        {
            foreach (var option in scenario.Options)
                request.AddOption(option.Key, option.Label);
        }
        else
        {
            request.WithPlaceholder(scenario.Options.Single().Label);
            if (scenario.RequestType == RequestType.Number)
            {
                request.WithKeyboard("decimal").WithInputValidation(new InputValidation
                {
                    Required = true,
                    Min = 0.01,
                    Max = 10_000
                });
            }
        }
        var result = await _client.SendRequestAsync(request.ExpiresIn(TimeSpan.FromMinutes(10)).Build(), resolverUrl, accessToken, cancellationToken);
        return result.Success
            ? new ParticipationRequestResult(true, result.RequestId)
            : new ParticipationRequestResult(false, Error: result.Error);
    }

    public async Task<ParticipationStatus> GetStatusAsync(string requestId, string userId, CancellationToken cancellationToken = default)
    {
        var registration = await _registrations.GetForAppUserAsync(userId, cancellationToken);
        var resolverUrl = string.IsNullOrWhiteSpace(_resolverUrl)
            ? registration?.ResolverBaseUrl ?? string.Empty
            : _resolverUrl;
        var result = await _client.GetStatusAsync(requestId, resolverUrl, registration?.AccessToken ?? _accessToken, cancellationToken);
        var attestationVerification = result.Status == RequestStatus.Resolved
            ? result.Attestation is null
                ? VerificationResult.Invalid("Resolved response did not include an attestation.")
                : await _client.VerifyAttestationAsync(result.Attestation, resolverUrl, cancellationToken)
            : VerificationResult.Verified();
        return new ParticipationStatus(
            result.Status == RequestStatus.Resolved,
            result.SelectedOption,
            result.SelectedOptions,
            result.Value,
            result.Status == RequestStatus.Expired,
            result.Attestation is null ? null : JsonSerializer.Serialize(result.Attestation),
            attestationVerification.Valid,
            attestationVerification.Error);
    }
}
