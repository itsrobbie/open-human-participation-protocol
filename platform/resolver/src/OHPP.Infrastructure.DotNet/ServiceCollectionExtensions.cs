using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.DotNet.Cryptography;
using OHPP.Infrastructure.DotNet.Http;
using OHPP.Infrastructure.DotNet.Notifications;
using OHPP.Infrastructure.DotNet.RateLimiting;

namespace OHPP.Infrastructure.DotNet;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers core .NET infrastructure services: clock, token generation, cryptography,
    /// notifications (SSE), rate limiting, and HTTP clients for metadata/callback.
    /// </summary>
    public static IServiceCollection AddOhppInfrastructure(this IServiceCollection services)
    {
        // Shared
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<ITokenGenerator, CryptoTokenGenerator>();

        // Notifications
        services.AddSingleton<SseNotificationChannel>();
        services.AddSingleton<INotificationChannel>(sp => sp.GetRequiredService<SseNotificationChannel>());
        services.AddSingleton<InMemoryEventBroadcaster>();
        services.AddSingleton<IEventBroadcaster>(sp => sp.GetRequiredService<InMemoryEventBroadcaster>());

        // Rate limiting
        services.AddSingleton<IRateLimitStore, InMemoryRateLimitStore>();

        // Cryptography
        services.AddSingleton<ISigner, Es256Signer>();
        services.AddSingleton<ISignatureVerifier, Es256SignatureVerifier>();
        services.AddSingleton<IKeyEncryptor, AesKeyEncryptor>();

        // HTTP clients
        services.AddHttpClient<IAppMetadataFetcher, HttpAppMetadataFetcher>();
        services.AddHttpClient<IRegistrationCallbackSender, HttpRegistrationCallbackSender>();

        return services;
    }
}
