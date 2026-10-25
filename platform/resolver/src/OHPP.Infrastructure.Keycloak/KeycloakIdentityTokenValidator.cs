using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.Keycloak;

/// <summary>
/// Validates identity tokens issued by Keycloak (or any OIDC-compliant provider).
/// Fetches JWKS from the provider's well-known endpoint and validates the JWT signature.
/// </summary>
public sealed class KeycloakIdentityTokenValidator : IIdentityTokenValidator
{
    private readonly KeycloakOptions _options;
    private readonly HttpClient _httpClient;
    private readonly JwtSecurityTokenHandler _tokenHandler = new();
    private TokenValidationParameters? _validationParams;

    public KeycloakIdentityTokenValidator(KeycloakOptions options, HttpClient httpClient)
    {
        _options = options;
        _httpClient = httpClient;
        _tokenHandler.InboundClaimTypeMap.Clear();
    }

    public async Task<IdentityTokenClaims> ValidateAsync(string token, CancellationToken cancellationToken = default)
    {
        var validationParams = await GetValidationParametersAsync(cancellationToken);

        var principal = await _tokenHandler.ValidateTokenAsync(token, validationParams);
        if (!principal.IsValid)
            throw new SecurityTokenValidationException("Token validation failed");

        var claims = principal.Claims;
        var sub = claims.TryGetValue("sub", out var subVal) ? subVal?.ToString() : null;
        var email = claims.TryGetValue("email", out var emailVal) ? emailVal?.ToString() : null;
        var name = claims.TryGetValue("preferred_username", out var nameVal) ? nameVal?.ToString() : null;
        
        // Fallback: try "name" claim if preferred_username is empty
        if (string.IsNullOrEmpty(name) && claims.TryGetValue("name", out var fullName))
            name = fullName?.ToString();

        if (string.IsNullOrEmpty(sub))
            throw new SecurityTokenValidationException("Token missing 'sub' claim");

        return new IdentityTokenClaims
        {
            ExternalId = sub,
            Email = email ?? $"{sub}@local",
            DisplayName = name
        };
    }

    private async Task<TokenValidationParameters> GetValidationParametersAsync(CancellationToken cancellationToken)
    {
        if (_validationParams is not null)
            return _validationParams;

        var jwksUrl = $"{_options.Authority.TrimEnd('/')}/protocol/openid-connect/certs";
        var response = await _httpClient.GetStringAsync(jwksUrl, cancellationToken);
        var jwks = new JsonWebKeySet(response);

        _validationParams = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = jwks.GetSigningKeys(),
            ValidateIssuer = true,
            ValidIssuers = BuildValidIssuers(_options.Authority),
            ValidateAudience = _options.ValidateAudience,
            ValidAudience = _options.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        return _validationParams;
    }

    /// <summary>
    /// Derives the set of acceptable token issuers from the configured authority.
    /// The internal JWKS-fetch authority and the browser-facing issuer can differ
    /// (e.g. the resolver talks to Keycloak internally over https://keycloak:8443
    /// while the browser obtained its token via http://localhost:8080). Tokens
    /// carry the issuer the *browser* used, so we accept the configured authority
    /// plus the browser-facing host variants of the same realm path, regardless of
    /// the internal scheme/host. This is derived by realm path rather than by a
    /// brittle host-string replacement so it survives the HTTP-to-HTTPS migration.
    /// </summary>
    public static string[] BuildValidIssuers(string authority)
    {
        var trimmed = authority.TrimEnd('/');
        var issuers = new List<string> { trimmed };

        // Extract the realm path (everything from "/realms/..." onward) so we can
        // reattach it to the browser-facing hosts.
        var realmIndex = trimmed.IndexOf("/realms/", StringComparison.Ordinal);
        if (realmIndex >= 0)
        {
            var realmPath = trimmed[realmIndex..];
            // Browser-facing hosts Keycloak may stamp into the issuer claim in dev.
            foreach (var host in new[] { "http://localhost:8080", "http://localhost:8180" })
            {
                var candidate = host + realmPath;
                if (!issuers.Contains(candidate))
                    issuers.Add(candidate);
            }
        }

        return issuers.ToArray();
    }
}
