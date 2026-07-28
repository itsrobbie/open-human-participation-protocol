using Microsoft.Extensions.DependencyInjection;

namespace OHPP.Sdk.Server;

/// <summary>
/// DI extensions for registering the OHPP Resolver SDK services.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the OHPP Resolver SDK with the required host implementations.
    /// Both type parameters are mandatory — they provide the backing logic and auth bridging.
    /// </summary>
    /// <typeparam name="TServices">
    /// The host's implementation of IOhppResolverServices (persistence, keys, business logic).
    /// Registered as Scoped — one instance per request.
    /// </typeparam>
    /// <typeparam name="TAuth">
    /// The host's implementation of IOhppAuthContextAccessor (bridges auth middleware to SDK).
    /// Registered as Singleton — stateless accessor.
    /// </typeparam>
    public static IServiceCollection AddOhppResolver<TServices, TAuth>(
        this IServiceCollection services,
        Action<OhppResolverOptions> configure)
        where TServices : class, IOhppResolverServices
        where TAuth : class, IOhppAuthContextAccessor
    {
        services.Configure(configure);
        services.AddScoped<IOhppResolverServices, TServices>();
        services.AddSingleton<IOhppAuthContextAccessor, TAuth>();

        return services;
    }
}
