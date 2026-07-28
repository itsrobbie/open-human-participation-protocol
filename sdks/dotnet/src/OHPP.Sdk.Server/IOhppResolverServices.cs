using OHPP.Protocol;
using OHPP.Protocol.Models;

namespace OHPP.Sdk.Server;

/// <summary>
/// Interface the host application must implement to wire the SDK's protocol routes to its own services layer.
/// The SDK handles routing, validation, and serialisation; the host handles business logic and persistence.
/// </summary>
public interface IOhppResolverServices
{
    /// <summary>
    /// Processes an inbound participation request from a Requester app.
    /// Called after the SDK validates the request payload against protocol schema rules.
    /// </summary>
    /// <param name="appRegistrationId">Internal ID of the registered app (from auth).</param>
    /// <param name="userId">User ID extracted from the validated auth token.</param>
    /// <param name="appId">App ID from the registration record.</param>
    /// <param name="requestPayload">Raw JSON payload of the participation request (pre-validated by SDK).</param>
    /// <returns>The request ID on success, or an error string on failure.</returns>
    Task<ResolverResult<string>> ProcessParticipationRequestAsync(
        Guid appRegistrationId,
        Guid userId,
        string appId,
        string requestPayload);

    /// <summary>
    /// Gets the current status of a participation request.
    /// </summary>
    /// <param name="requestId">The ID of the request to check.</param>
    /// <param name="appRegistrationId">The calling app's registration ID (for ownership verification).</param>
    /// <returns>Status information and optional attestation envelope.</returns>
    Task<ResolverResult<RequestStatusResponse>> GetRequestStatusAsync(
        Guid requestId,
        Guid appRegistrationId);

    /// <summary>
    /// Cancels a pending participation request.
    /// </summary>
    /// <param name="requestId">The ID of the request to cancel.</param>
    /// <param name="appRegistrationId">The calling app's registration ID (for ownership verification).</param>
    Task<ResolverResult<bool>> CancelRequestAsync(
        Guid requestId,
        Guid appRegistrationId);

    /// <summary>
    /// Gets all public keys (active and retired) for attestation verification.
    /// </summary>
    Task<JwkSet> GetJwksAsync();
}

/// <summary>
/// Result type for Resolver service operations.
/// </summary>
public sealed class ResolverResult<T>
{
    public bool IsSuccess { get; init; }
    public T? Value { get; init; }
    public string? Error { get; init; }
    public int SuggestedStatusCode { get; init; } = 200;

    public static ResolverResult<T> Ok(T value) => new()
    {
        IsSuccess = true,
        Value = value
    };

    public static ResolverResult<T> Fail(string error, int statusCode = 400) => new()
    {
        IsSuccess = false,
        Error = error,
        SuggestedStatusCode = statusCode
    };
}

/// <summary>
/// Response DTO for participation request status queries.
/// </summary>
public sealed class RequestStatusResponse
{
    public required RequestStatus Status { get; init; }
    public AttestationEnvelope? Attestation { get; init; }
}
