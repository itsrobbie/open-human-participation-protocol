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

    // --- Broker (account creation + token issuance) --------------------------
    // Only the broker needs these; token VALIDATION uses Authority alone. The
    // client never sees any of this — it reaches the Resolver's /api/auth, which
    // uses the broker, which uses these to talk to Keycloak.

    /// <summary>
    /// Base URL of the Keycloak server WITHOUT the realm path
    /// (e.g. "http://keycloak:8080"). Derived from Authority when unset.
    /// </summary>
    public string? ServerBaseUrl { get; set; }

    /// <summary>Realm to create users in / issue tokens from (e.g. "ohpp").</summary>
    public string Realm { get; set; } = "ohpp";

    /// <summary>
    /// Public OIDC client id used for the resource-owner-password token grant
    /// (e.g. "ohpp-portal"). A public client, so no secret.
    /// </summary>
    public string TokenClientId { get; set; } = "ohpp-portal";

    /// <summary>Admin username for the admin REST API (dev: "admin").</summary>
    public string? AdminUsername { get; set; }

    /// <summary>Admin password for the admin REST API (dev: "admin").</summary>
    public string? AdminPassword { get; set; }

    /// <summary>
    /// Realm the admin account lives in for the admin token grant. Keycloak's
    /// bootstrap admin lives in "master".
    /// </summary>
    public string AdminRealm { get; set; } = "master";

    /// <summary>Admin CLI client id for the admin token grant.</summary>
    public string AdminClientId { get; set; } = "admin-cli";
}
