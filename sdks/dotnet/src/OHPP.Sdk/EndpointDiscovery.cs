using System.Collections.Concurrent;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk;

/// <summary>
/// Fetches and caches Resolver service metadata from /.well-known/ohpp/metadata.
/// </summary>
public sealed class EndpointDiscovery
{
    private readonly HttpClient _httpClient;
    private readonly int _cacheDurationSeconds;
    private readonly ConcurrentDictionary<string, CachedMetadata> _cache = new();

    public EndpointDiscovery(HttpClient httpClient, int cacheDurationSeconds = 300)
    {
        _httpClient = httpClient;
        _cacheDurationSeconds = cacheDurationSeconds;
    }

    /// <summary>
    /// Gets the service metadata for the given Resolver, fetching and caching as needed.
    /// </summary>
    public async Task<ServiceMetadata?> GetMetadataAsync(string resolverBaseUrl, CancellationToken cancellationToken = default)
    {
        var key = resolverBaseUrl.TrimEnd('/');

        if (_cache.TryGetValue(key, out var cached) && !cached.IsExpired)
            return cached.Metadata;

        var metadata = await FetchMetadataAsync(key, cancellationToken);
        if (metadata is not null)
        {
            _cache[key] = new CachedMetadata(metadata, DateTimeOffset.UtcNow.AddSeconds(_cacheDurationSeconds));
        }

        return metadata;
    }

    /// <summary>
    /// Invalidates the cache for a specific Resolver, forcing a fresh fetch on next access.
    /// </summary>
    public void InvalidateCache(string resolverBaseUrl)
    {
        _cache.TryRemove(resolverBaseUrl.TrimEnd('/'), out _);
    }

    private async Task<ServiceMetadata?> FetchMetadataAsync(string baseUrl, CancellationToken cancellationToken)
    {
        var url = $"{baseUrl}{ProtocolConstants.WellKnownMetadataPath}";

        var response = await _httpClient.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return OhppJsonSerialiser.Deserialise<ServiceMetadata>(json);
    }

    private sealed record CachedMetadata(ServiceMetadata Metadata, DateTimeOffset ExpiresAt)
    {
        public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAt;
    }
}
