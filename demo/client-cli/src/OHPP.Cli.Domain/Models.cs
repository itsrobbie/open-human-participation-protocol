namespace OHPP.Cli.Domain;

/// <summary>
/// Persisted CLI configuration (device token, resolver URL, key paths).
/// </summary>
public sealed class CliConfig
{
    public string? DeviceToken { get; set; }
    public string? ResolverUrl { get; set; }
    public string? PrivateKeyPem { get; set; }
    public string? PublicKeyPem { get; set; }
    public bool IsConfigured => !string.IsNullOrWhiteSpace(DeviceToken) && !string.IsNullOrWhiteSpace(ResolverUrl);
    public bool HasKeyPair => !string.IsNullOrWhiteSpace(PrivateKeyPem) && !string.IsNullOrWhiteSpace(PublicKeyPem);
}

/// <summary>
/// A participation request received from the Resolver via SSE or pending endpoint.
/// </summary>
public sealed class IncomingRequest
{
    public required Guid RequestId { get; init; }
    public required string AppId { get; init; }
    public required string Summary { get; init; }
    public string? Description { get; init; }
    public string? Rationale { get; init; }
    public string? Category { get; init; }
    public required string Type { get; init; }
    public IReadOnlyList<RequestOption>? Options { get; init; }
    public DateTimeOffset? Expiry { get; init; }
    public DateTimeOffset ReceivedAt { get; init; }
}

/// <summary>
/// An option available for selection in a participation request.
/// </summary>
public sealed class RequestOption
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public bool FreeText { get; init; }
    public string? Placeholder { get; init; }
}
