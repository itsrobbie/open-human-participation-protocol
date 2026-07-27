namespace OHPP.Domain.Participation;

public interface IExpiryEnforcementService
{
    Task<int> EnforceExpiredRequestsAsync(CancellationToken cancellationToken = default);
    bool CheckAndExpireIfNeeded(PendingRequest request);
}
