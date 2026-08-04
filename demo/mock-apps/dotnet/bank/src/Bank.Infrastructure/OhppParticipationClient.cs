using Bank.Domain;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;

namespace Bank.Infrastructure;

/// <summary>
/// Bridges Bank.Domain.IParticipationClient to the OHPP.Sdk Requester SDK.
/// Sends participation requests via the SDK and polls for status.
/// </summary>
public sealed class OhppParticipationClient : IParticipationClient
{
    private readonly IOhppRequesterClient _requesterClient;
    private readonly string _appId;

    public OhppParticipationClient(IOhppRequesterClient requesterClient, string appId)
    {
        _requesterClient = requesterClient;
        _appId = appId;
    }

    public async Task<string?> RequestParticipationAsync(
        OhppRegistration registration,
        string summary,
        string description,
        decimal amount,
        string payeeName,
        CancellationToken cancellationToken = default)
    {
        var request = new ParticipationRequestBuilder()
            .ForUser(registration.UserId)
            .FromApp(_appId)
            .WithSummary(summary)
            .WithDescription(description)
            .WithCategory("transfer")
            .OfType(RequestType.Select)
            .AddOption("approve", "Approve transfer")
            .AddOption("deny", "Deny transfer")
            .ExpiresIn(TimeSpan.FromMinutes(5))
            .Build();

        try
        {
            var result = await _requesterClient.SendRequestAsync(
                request, registration.ResolverUrl, registration.AccessToken, cancellationToken);

            return result.Success ? result.RequestId : null;
        }
        catch (HttpRequestException)
        {
            // Resolver unreachable — treat as transient failure
            return null;
        }
    }

    public async Task<TransferStatus> CheckStatusAsync(
        OhppRegistration registration,
        string requestId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _requesterClient.GetStatusAsync(
                requestId, registration.ResolverUrl, registration.AccessToken, cancellationToken);

            if (!result.Success)
            {
                // Transient failures (network issues, resolver temporarily unavailable)
                // should NOT terminate the polling loop — treat as still pending.
                return TransferStatus.PendingApproval;
            }

            if (result.Status == RequestStatus.Resolved)
            {
                if (result.Attestation is null)
                    return TransferStatus.Failed;
                var verification = await _requesterClient.VerifyAttestationAsync(
                    result.Attestation,
                    registration.ResolverUrl,
                    cancellationToken);
                if (!verification.Valid)
                    return TransferStatus.Failed;

                // Read the user's selected option to determine the outcome.
                // The bank sent options ["approve", "deny"] — check which one was chosen.
                return result.SelectedOption switch
                {
                    "approve" => TransferStatus.Completed,
                    "deny" => TransferStatus.Denied,
                    _ => TransferStatus.Failed
                };
            }

            return result.Status switch
            {
                RequestStatus.Pending => TransferStatus.PendingApproval,
                RequestStatus.Expired => TransferStatus.Expired,
                RequestStatus.Cancelled => TransferStatus.Denied,
                _ => TransferStatus.PendingApproval
            };
        }
        catch (HttpRequestException)
        {
            // Resolver unreachable — treat as still pending, poll will retry
            return TransferStatus.PendingApproval;
        }
    }
}
