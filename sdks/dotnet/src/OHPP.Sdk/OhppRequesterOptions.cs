namespace OHPP.Sdk;

/// <summary>
/// Configuration for a Requester application integrating with OHPP.
/// </summary>
public sealed class OhppRequesterOptions
{
    /// <summary>
    /// Domain-based identifier for this app (e.g., "pizza.example.com").
    /// Must match what's served at /.well-known/ohpp/app-metadata.
    /// </summary>
    public required string AppId { get; set; }

    /// <summary>
    /// Human-readable name shown to users in the Resolver/Client.
    /// </summary>
    public required string AppName { get; set; }

    /// <summary>
    /// Relative path for the registration callback endpoint (e.g., "/ohpp/callback").
    /// The SDK registers middleware at this path to handle inbound callbacks.
    /// </summary>
    public required string CallbackPath { get; set; }

    /// <summary>
    /// Public base URL of this application (e.g., "https://pizza.example.com").
    /// Used to build the full callback URL and serve app-metadata.
    /// </summary>
    public required string BaseUrl { get; set; }

    /// <summary>
    /// Optional icon URL for the app, displayed in Client UIs.
    /// </summary>
    public string? IconUrl { get; set; }

    /// <summary>
    /// Protocol version this app supports. Defaults to "1.0".
    /// </summary>
    public string ProtocolVersion { get; set; } = Protocol.ProtocolConstants.Version;

    /// <summary>
    /// How long to cache discovered Resolver metadata (seconds). Defaults to 300.
    /// </summary>
    public int MetadataCacheDurationSeconds { get; set; } = 300;

    /// <summary>
    /// How long to wait for HTTP calls to the Resolver (seconds). Defaults to 30.
    /// </summary>
    public int HttpTimeoutSeconds { get; set; } = 30;
}
