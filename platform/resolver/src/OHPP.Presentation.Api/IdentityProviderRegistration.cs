using OHPP.Infrastructure.Firebase;
using OHPP.Infrastructure.Keycloak;

namespace OHPP.Presentation.Api;

/// <summary>
/// Selects and registers the identity provider based on configuration.
/// Auth__Provider: "Firebase" (production) | "Keycloak" (local/dev)
/// </summary>
public static class IdentityProviderRegistration
{
    public static IServiceCollection AddOhppIdentityProvider(this IServiceCollection services, IConfiguration config)
    {
        var provider = config["Auth:Provider"] ?? "Keycloak";

        switch (provider.ToLowerInvariant())
        {
            case "firebase":
                services.AddOhppFirebaseAuth();
                break;

            case "keycloak":
                services.AddOhppKeycloakAuth(options =>
                {
                    options.Authority = config["Auth:Keycloak:Authority"]
                        ?? "http://keycloak:8080/realms/ohpp";
                    options.Audience = config["Auth:Keycloak:Audience"];
                    options.ValidateAudience = !string.IsNullOrEmpty(config["Auth:Keycloak:Audience"]);

                    // Broker config (account creation + token issuance). These
                    // stay server-side; no client ever sees them. ServerBaseUrl
                    // derives from Authority when unset.
                    options.ServerBaseUrl = config["Auth:Keycloak:ServerBaseUrl"];
                    options.Realm = config["Auth:Keycloak:Realm"] ?? "ohpp";
                    options.TokenClientId = config["Auth:Keycloak:TokenClientId"] ?? "ohpp-portal";
                    options.AdminUsername = config["Auth:Keycloak:AdminUsername"];
                    options.AdminPassword = config["Auth:Keycloak:AdminPassword"];
                    options.AdminRealm = config["Auth:Keycloak:AdminRealm"] ?? "master";
                    options.AdminClientId = config["Auth:Keycloak:AdminClientId"] ?? "admin-cli";
                });
                break;

            default:
                throw new InvalidOperationException(
                    $"Unknown Auth:Provider '{provider}'. Supported: 'Firebase', 'Keycloak'");
        }

        return services;
    }
}
