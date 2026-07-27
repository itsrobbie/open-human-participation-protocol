using System.Collections.Concurrent;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.DotNet.RateLimiting;

public sealed class InMemoryRateLimitStore : IRateLimitStore
{
    private readonly ConcurrentDictionary<string, List<DateTimeOffset>> _entries = new();
    private readonly IClock _clock;

    public InMemoryRateLimitStore(IClock clock)
    {
        _clock = clock;
    }

    public Task<bool> IsRateLimitedAsync(string key, int maxRequests, TimeSpan window, CancellationToken cancellationToken = default)
    {
        PruneExpired(key, window);

        if (!_entries.TryGetValue(key, out var timestamps))
            return Task.FromResult(false);

        return Task.FromResult(timestamps.Count >= maxRequests);
    }

    public Task IncrementAsync(string key, TimeSpan window, CancellationToken cancellationToken = default)
    {
        var timestamps = _entries.GetOrAdd(key, _ => new List<DateTimeOffset>());

        lock (timestamps)
        {
            timestamps.Add(_clock.UtcNow);
        }

        return Task.CompletedTask;
    }

    private void PruneExpired(string key, TimeSpan window)
    {
        if (!_entries.TryGetValue(key, out var timestamps))
            return;

        var cutoff = _clock.UtcNow - window;

        lock (timestamps)
        {
            timestamps.RemoveAll(t => t < cutoff);
        }
    }
}
