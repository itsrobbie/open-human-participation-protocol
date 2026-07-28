using OHPP.Domain.Auth;

namespace OHPP.Tests.Integration.Api.Infrastructure;

/// <summary>
/// Fake identity token validator for integration tests.
/// Returns configurable claims without hitting a real identity provider.
/// Tokens of the form "idp_{userId}_{email}" are treated as valid.
/// </summary>
public sealed class FakeIdentityTokenValidator : IIdentityTokenValidator
{
    private readonly Dictionary<string, IdentityTokenClaims> _tokens = new();
    private bool _failAll;

    /// <summary>
    /// Registers a token that will resolve to the given claims.
    /// </summary>
    public void RegisterToken(string token, IdentityTokenClaims claims)
    {
        _tokens[token] = claims;
    }

    /// <summary>
    /// Makes all token validations fail (simulates expired/invalid tokens).
    /// </summary>
    public void FailAll()
    {
        _failAll = true;
    }

    public Task<IdentityTokenClaims> ValidateAsync(string token, CancellationToken cancellationToken = default)
    {
        if (_failAll)
            throw new InvalidOperationException("Token validation failed (test mode)");

        if (_tokens.TryGetValue(token, out var claims))
            return Task.FromResult(claims);

        // Convention: "idp_{externalId}_{email}" auto-generates claims
        if (token.StartsWith("idp_"))
        {
            var parts = token.Split('_', 3);
            if (parts.Length == 3)
            {
                return Task.FromResult(new IdentityTokenClaims
                {
                    ExternalId = parts[1],
                    Email = parts[2],
                    DisplayName = $"Test User {parts[1]}"
                });
            }
        }

        throw new InvalidOperationException($"Unknown token: {token}");
    }
}
