using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.Keycloak;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Keycloak as the identity token validator.
    /// Validates JWTs against Keycloak's JWKS endpoint.
    /// </summary>
    public static IServiceCollection AddOhppKeycloakAuth(this IServiceCollection services, Action<KeycloakOptions> configure)
    {
        var options = new KeycloakOptions { Authority = "" };
        configure(options);

        services.AddSingleton(options);
        services.AddHttpClient<IIdentityTokenValidator, KeycloakIdentityTokenValidator>();
        // The broker (account creation + token issuance) shares the Keycloak
        // options; its own HttpClient talks to the admin + token endpoints.
        services.AddHttpClient<IIdentityBroker, KeycloakIdentityBroker>();

        return services;
    }
}
