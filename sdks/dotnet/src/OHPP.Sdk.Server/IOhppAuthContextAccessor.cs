using Microsoft.AspNetCore.Http;

namespace OHPP.Sdk.Server;

/// <summary>
/// Extracts authentication context from the current HTTP request.
/// The host implements this to bridge its own auth middleware to the SDK endpoints.
/// </summary>
public interface IOhppAuthContextAccessor
{
    /// <summary>
    /// Extracts the app authentication context from the request.
    /// Returns null if the request is not authenticated as an app (AppAccess token type).
    /// </summary>
    OhppAppAuthContext? GetAppContext(HttpContext context);
}

/// <summary>
/// Authentication context for an app-authenticated request.
/// </summary>
public sealed class OhppAppAuthContext
{
    public required Guid AppRegistrationId { get; init; }
    public required Guid UserId { get; init; }
    public required string AppId { get; init; }
}
