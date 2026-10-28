using OHPP.Domain.Shared;

namespace OHPP.Domain.Auth;

/// <summary>
/// Brokers account creation and authentication against the configured identity
/// provider, so the CLIENT never talks to the provider directly.
///
/// This is the seam that keeps the identity provider HIDDEN and SWAPPABLE: the
/// app and Portal call the Resolver's /api/auth endpoints, the Resolver calls
/// this broker, and the concrete implementation (Keycloak in dev, Firebase or
/// another provider in production) is selected by Auth:Provider config. No realm,
/// client id, or provider URL ever crosses to a client, and swapping the provider
/// is a config + implementation change with no client or user-visible effect.
///
/// Distinct from <see cref="IIdentityTokenValidator"/> (which only VERIFIES an
/// inbound token): this ISSUES identity — it creates users and mints tokens.
/// </summary>
public interface IIdentityBroker
{
    /// <summary>
    /// Create a new end-user account with the provider and return its tokens so
    /// the caller is immediately authenticated (no second round-trip). Fails with
    /// <see cref="Error.Conflict"/> if the username/email already exists and
    /// <see cref="Error.Validation"/> for a rejected password/email.
    /// </summary>
    Task<Result<BrokeredAuth>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Authenticate an existing end user by credentials and return their tokens.
    /// Fails with <see cref="Error.Unauthorized"/> on bad credentials.
    /// </summary>
    Task<Result<BrokeredAuth>> AuthenticateAsync(AuthenticateRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Exchange a refresh token for a fresh access token, so the client renews a
    /// session without ever contacting the provider directly. Fails with
    /// <see cref="Error.Unauthorized"/> when the refresh token is invalid/expired.
    /// </summary>
    Task<Result<BrokeredAuth>> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
}

/// <summary>New-account details supplied by the client (never the provider).</summary>
public sealed record RegisterRequest(
    string Username,
    string Email,
    string Password,
    string? FirstName = null,
    string? LastName = null);

/// <summary>Credentials for an existing account.</summary>
public sealed record AuthenticateRequest(string Username, string Password);

/// <summary>
/// The tokens the broker hands back. Provider-agnostic on purpose: the client
/// receives only these fields, never anything that names the provider.
/// </summary>
public sealed record BrokeredAuth(
    string AccessToken,
    string? RefreshToken,
    int ExpiresInSeconds,
    string UserId);
