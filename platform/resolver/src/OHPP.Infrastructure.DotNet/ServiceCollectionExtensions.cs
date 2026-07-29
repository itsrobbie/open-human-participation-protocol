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
    /// <param name="services">Service collection</param>
    /// <param name="resolverBaseUrl">Base URL of the Resolver (for registration callbacks)</param>
    /// <param name="encryptionKey">AES encryption key for signing key storage</param>
    /// <param name="appIdOverrides">Optional mapping of appId to internal base URL (for Docker/dev environments)</param>
    public static IServiceCollection AddOhppInfrastructure(
        this IServiceCollection services,
        string resolverBaseUrl,
        string encryptionKey,
        IReadOnlyDictionary<string, string>? appIdOverrides = null)
    {
        // Configuration
        services.AddSingleton<IResolverConfiguration>(new ResolverConfigurationRecord(resolverBaseUrl));
        services.AddSingleton<IKeyEncryptionConfiguration>(new KeyEncryptionConfigurationRecord(encryptionKey));

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
        services.AddHttpClient("AppMetadata");
        services.AddHttpClient("RegistrationCallback");
        services.AddScoped<IAppMetadataFetcher, HttpAppMetadataFetcher>();
        services.AddScoped<IRegistrationCallbackSender, HttpRegistrationCallbackSender>();

        // App ID resolution (maps domain-based appId to base URL)
        services.AddSingleton<IAppIdResolver>(new DevModeAppIdResolver(
            appIdOverrides ?? new Dictionary<string, string>()));

        return services;
    }
}

internal sealed record ResolverConfigurationRecord(string BaseUrl) : IResolverConfiguration;
internal sealed record KeyEncryptionConfigurationRecord(string EncryptionKey) : IKeyEncryptionConfiguration;
