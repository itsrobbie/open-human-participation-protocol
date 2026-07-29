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
            ValidIssuers = new[] { _options.Authority, _options.Authority.Replace("keycloak:8080", "localhost:8080") },
            ValidateAudience = _options.ValidateAudience,
            ValidAudience = _options.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        return _validationParams;
    }
}
