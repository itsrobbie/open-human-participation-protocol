using FirebaseAdmin;
using FirebaseAdmin.Auth;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.Firebase;

public sealed class FirebaseIdentityTokenValidator : IIdentityTokenValidator
{
    private readonly FirebaseAuth _firebaseAuth;

    public FirebaseIdentityTokenValidator(FirebaseApp firebaseApp)
    {
        _firebaseAuth = FirebaseAuth.GetAuth(firebaseApp);
    }

    public async Task<IdentityTokenClaims> ValidateAsync(string token, CancellationToken cancellationToken = default)
    {
        var decodedToken = await _firebaseAuth.VerifyIdTokenAsync(token, cancellationToken);

        var email = decodedToken.Claims.TryGetValue("email", out var emailClaim)
            ? emailClaim?.ToString() ?? string.Empty
            : string.Empty;

        var displayName = decodedToken.Claims.TryGetValue("name", out var nameClaim)
            ? nameClaim?.ToString()
            : null;

        return new IdentityTokenClaims
        {
            ExternalId = decodedToken.Uid,
            Email = email,
            DisplayName = displayName
        };
    }
}
