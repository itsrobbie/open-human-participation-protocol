using OHPP.Protocol.Models;

namespace OHPP.Sdk;

/// <summary>
/// Primary interface for Requester applications to interact with an OHPP Resolver.
/// </summary>
public interface IOhppRequesterClient
{
    /// <summary>
    /// Sends a participation request to the Resolver for the given user.
    /// Returns the request ID for subsequent status polling.
    /// </summary>
    Task<ParticipationResult> SendRequestAsync(
        ParticipationRequest request,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Polls the Resolver for the current status of a participation request.
    /// </summary>
    Task<RequestStatusResult> GetStatusAsync(
        string requestId,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels a pending participation request.
    /// </summary>
    Task<CancelResult> CancelRequestAsync(
        string requestId,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies an attestation envelope's outer signature against the Resolver's JWKS.
    /// </summary>
    Task<VerificationResult> VerifyAttestationAsync(
        AttestationEnvelope envelope,
        string resolverBaseUrl,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Discovers the Resolver's service metadata from /.well-known/ohpp/metadata.
    /// </summary>
    Task<ServiceMetadata?> DiscoverMetadataAsync(
        string resolverBaseUrl,
        CancellationToken cancellationToken = default);
}
