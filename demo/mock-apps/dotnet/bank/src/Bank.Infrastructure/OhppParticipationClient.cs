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

        var result = await _requesterClient.SendRequestAsync(
            request, registration.ResolverUrl, registration.AccessToken, cancellationToken);

        return result.Success ? result.RequestId : null;
    }

    public async Task<TransferStatus> CheckStatusAsync(
        OhppRegistration registration,
        string requestId,
        CancellationToken cancellationToken = default)
    {
        var result = await _requesterClient.GetStatusAsync(
            requestId, registration.ResolverUrl, registration.AccessToken, cancellationToken);

        if (!result.Success)
            return TransferStatus.Failed;

        return result.Status switch
        {
            RequestStatus.Pending => TransferStatus.PendingApproval,
            RequestStatus.Resolved => TransferStatus.Completed,
            RequestStatus.Expired => TransferStatus.Expired,
            RequestStatus.Cancelled => TransferStatus.Denied,
            _ => TransferStatus.Failed
        };
    }
}
