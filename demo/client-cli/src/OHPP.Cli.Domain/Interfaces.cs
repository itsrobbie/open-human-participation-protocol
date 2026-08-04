namespace OHPP.Cli.Domain;

/// <summary>
/// Generates EC key pairs for attestation signing.
/// </summary>
public interface IKeyPairGenerator
{
    /// <summary>
    /// Generates a new ES256 (P-256) key pair. Returns (publicKeyPem, privateKeyPem).
    /// </summary>
    (string PublicKeyPem, string PrivateKeyPem) Generate();
}

/// <summary>
/// Persists and loads CLI configuration.
/// </summary>
public interface IConfigStore
{
    Task<CliConfig> LoadAsync(CancellationToken cancellationToken = default);
    Task SaveAsync(CliConfig config, CancellationToken cancellationToken = default);
}

/// <summary>
/// HTTP client for communicating with the Resolver's device endpoints.
/// </summary>
public interface IResolverClient
{
    /// <summary>
    /// Registers the device's public key with the Resolver.
    /// </summary>
    Task<bool> RegisterPublicKeyAsync(string publicKeyPem, string algorithm, CancellationToken cancellationToken = default);

    /// <summary>
    /// Fetches all pending participation requests for this device.
    /// Returns null if the token is invalid/revoked (401/403).
    /// </summary>
    Task<IReadOnlyList<IncomingRequest>?> GetPendingRequestsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Submits a signed attestation to the Resolver.
    /// </summary>
    Task<bool> SubmitAttestationAsync(Guid requestId, string attestationPayload, string signature, CancellationToken cancellationToken = default);
}

/// <summary>
/// SSE connection to the Resolver for real-time request delivery.
/// </summary>
public interface ISseClient
{
    /// <summary>
    /// Connects to the SSE stream and yields incoming requests as they arrive.
    /// </summary>
    IAsyncEnumerable<IncomingRequest> ConnectAsync(CancellationToken cancellationToken = default);
}
