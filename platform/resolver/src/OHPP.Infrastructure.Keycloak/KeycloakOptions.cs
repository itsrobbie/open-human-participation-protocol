namespace OHPP.Infrastructure.Keycloak;

public sealed class KeycloakOptions
{
    /// <summary>
    /// Keycloak realm URL (e.g., "http://keycloak:8080/realms/ohpp").
    /// This is the token issuer.
    /// </summary>
    public required string Authority { get; set; }

    /// <summary>
    /// Expected audience claim. If null, audience validation is skipped.
    /// </summary>
    public string? Audience { get; set; }

    /// <summary>
    /// Whether to validate the audience claim. Defaults to false for development.
    /// </summary>
    public bool ValidateAudience { get; set; } = false;
}
