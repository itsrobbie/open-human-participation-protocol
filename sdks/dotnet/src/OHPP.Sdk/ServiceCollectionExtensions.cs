using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace OHPP.Sdk;

/// <summary>
/// DI extensions for registering the OHPP Requester SDK in an ASP.NET Core application.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the OHPP Requester SDK services.
    /// After calling this, inject IOhppRequesterClient to send participation requests.
    /// </summary>
    public static IServiceCollection AddOhppRequester(
        this IServiceCollection services,
        Action<OhppRequesterOptions> configure)
    {
        services.Configure(configure);

        services.AddHttpClient<IOhppRequesterClient, OhppRequesterClient>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<OhppRequesterOptions>>().Value;
            client.Timeout = TimeSpan.FromSeconds(options.HttpTimeoutSeconds);
        });

        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<IOptions<OhppRequesterOptions>>().Value;
            var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
            var httpClient = httpClientFactory.CreateClient(nameof(EndpointDiscovery));
            return new EndpointDiscovery(httpClient, options.MetadataCacheDurationSeconds);
        });

        services.AddSingleton<ChallengeGenerator>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<OhppRequesterOptions>>().Value;
            return new ChallengeGenerator(options);
        });

        services.AddSingleton<CallbackHandler>();

        return services;
    }
}
