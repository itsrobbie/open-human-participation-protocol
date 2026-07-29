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
                });
                break;

            default:
                throw new InvalidOperationException(
                    $"Unknown Auth:Provider '{provider}'. Supported: 'Firebase', 'Keycloak'");
        }

        return services;
    }
}
