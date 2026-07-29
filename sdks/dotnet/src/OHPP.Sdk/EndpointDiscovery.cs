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
        var metadata = OhppJsonSerialiser.Deserialise<ServiceMetadata>(json);

        // Rebase endpoint URLs to use the caller's resolverBaseUrl.
        // The metadata may advertise URLs using the Resolver's public hostname
        // (e.g., http://localhost:5050) which isn't reachable from the caller's network.
        // Since the caller already proved they can reach `baseUrl`, rewrite endpoints
        // to use that same origin.
        if (metadata?.Endpoints is not null)
        {
            metadata = new ServiceMetadata
            {
                Name = metadata.Name,
                ProtocolVersion = metadata.ProtocolVersion,
                Endpoints = RebaseEndpoints(metadata.Endpoints, baseUrl)
            };
        }

        return metadata;
    }

    private static ServiceEndpoints RebaseEndpoints(ServiceEndpoints endpoints, string targetBaseUrl)
    {
        return new ServiceEndpoints
        {
            Participate = RebaseUrl(endpoints.Participate, targetBaseUrl),
            ParticipateStatus = RebaseUrl(endpoints.ParticipateStatus, targetBaseUrl),
            Keys = RebaseUrl(endpoints.Keys, targetBaseUrl),
            Federation = endpoints.Federation is not null ? RebaseUrl(endpoints.Federation, targetBaseUrl) : null
        };
    }

    private static string RebaseUrl(string originalUrl, string targetBaseUrl)
    {
        if (string.IsNullOrEmpty(originalUrl))
            return originalUrl;

        // Extract the path portion from the original URL and prepend the target base.
        // We avoid using Uri.PathAndQuery because it URL-encodes template parameters
        // like {requestId} into %7BrequestId%7D, breaking downstream Replace() calls.
        if (originalUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            originalUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            // Find the path start (after scheme://host[:port])
            var schemeEnd = originalUrl.IndexOf("://", StringComparison.Ordinal) + 3;
            var pathStart = originalUrl.IndexOf('/', schemeEnd);
            if (pathStart < 0)
                return targetBaseUrl; // No path — just the base

            var path = originalUrl[pathStart..]; // e.g. /api/participate/{requestId}/status
            return $"{targetBaseUrl.TrimEnd('/')}{path}";
        }

        // Already a relative path — just prepend the base
        return $"{targetBaseUrl.TrimEnd('/')}/{originalUrl.TrimStart('/')}";
    }

    private sealed record CachedMetadata(ServiceMetadata Metadata, DateTimeOffset ExpiresAt)
    {
        public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAt;
    }
}
