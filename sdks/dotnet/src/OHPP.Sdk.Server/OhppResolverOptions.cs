namespace OHPP.Sdk.Server;

/// <summary>
/// Configuration for an OHPP Resolver using the SDK Server routing layer.
/// </summary>
public sealed class OhppResolverOptions
{
    /// <summary>
    /// Public base URL of the Resolver (e.g., "https://resolve.example.com").
    /// Used to generate absolute endpoint URLs in service metadata.
    /// </summary>
    public required string BaseUrl { get; set; }

    /// <summary>
    /// Human-readable name of this Resolver, returned in service metadata.
    /// </summary>
    public string Name { get; set; } = "OHPP Resolver";

    /// <summary>
    /// Minimum protocol version supported by this Resolver.
    /// </summary>
    public string ProtocolVersionMin { get; set; } = Protocol.ProtocolConstants.Version;

    /// <summary>
    /// Maximum protocol version supported by this Resolver.
    /// </summary>
    public string ProtocolVersionMax { get; set; } = Protocol.ProtocolConstants.Version;

    /// <summary>
    /// Relative path for the participate endpoint. Defaults to "/api/participate".
    /// </summary>
    public string ParticipatePath { get; set; } = "/api/participate";

    /// <summary>
    /// Relative path template for the status endpoint. Defaults to "/api/participate/{requestId}/status".
    /// </summary>
    public string StatusPathTemplate { get; set; } = "/api/participate/{requestId}/status";

    /// <summary>
    /// Relative path template for the cancel endpoint. Defaults to "/api/participate/{requestId}/cancel".
    /// </summary>
    public string CancelPathTemplate { get; set; } = "/api/participate/{requestId}/cancel";

    /// <summary>
    /// Relative path for the JWKS endpoint. Defaults to "/.well-known/ohpp/keys".
    /// </summary>
    public string JwksPath { get; set; } = "/.well-known/ohpp/keys";

    /// <summary>
    /// Optional federation endpoint URL (null means federation not supported).
    /// </summary>
    public string? FederationEndpoint { get; set; }
}
