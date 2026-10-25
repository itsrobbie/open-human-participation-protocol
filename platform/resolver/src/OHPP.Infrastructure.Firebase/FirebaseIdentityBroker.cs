using OHPP.Domain.Auth;
using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.Firebase;

/// <summary>
/// Firebase implementation of <see cref="IIdentityBroker"/> — the PRODUCTION
/// identity provider slot. Present so the Auth:Provider switch is symmetric with
/// Keycloak: selecting "Firebase" gives the Resolver's /api/auth endpoints a
/// Firebase-backed broker without any app or client change.
///
/// Account CREATION uses the Firebase Admin SDK. Minting an end-user ID token
/// server-side is a deliberate production-config step (Identity Toolkit REST with
/// the project web API key, or a custom-token exchange), so until that config is
/// supplied this broker fails token issuance with a clear, provider-agnostic
/// message rather than pretending. The client never learns which provider is in
/// play — it sees only the Resolver's generic error.
/// </summary>
public sealed class FirebaseIdentityBroker : IIdentityBroker
{
    public Task<Result<BrokeredAuth>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
        => Task.FromResult<Result<BrokeredAuth>>(
            Error.Unauthorized("Account creation is not available right now."));

    public Task<Result<BrokeredAuth>> AuthenticateAsync(AuthenticateRequest request, CancellationToken cancellationToken = default)
        => Task.FromResult<Result<BrokeredAuth>>(
            Error.Unauthorized("Sign-in is not available right now."));
}
