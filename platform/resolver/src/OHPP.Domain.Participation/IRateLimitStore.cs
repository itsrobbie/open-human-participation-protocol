namespace OHPP.Domain.Participation;

public interface IRateLimitStore
{
    Task<bool> IsRateLimitedAsync(string key, int maxRequests, TimeSpan window, CancellationToken cancellationToken = default);
    Task IncrementAsync(string key, TimeSpan window, CancellationToken cancellationToken = default);
}
