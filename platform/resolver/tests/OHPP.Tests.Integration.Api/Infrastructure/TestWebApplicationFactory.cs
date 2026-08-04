using System.Security.Cryptography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using OHPP.Domain.Auth;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.PostgreSQL;
using OHPP.Presentation.Api.BackgroundServices;
using Testcontainers.PostgreSql;
using Xunit;

namespace OHPP.Tests.Integration.Api.Infrastructure;

/// <summary>
/// WebApplicationFactory that boots the real app against a Testcontainers PostgreSQL instance
/// and swaps Firebase auth for a fake identity token validator.
/// </summary>
public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("ohpp_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public FakeIdentityTokenValidator FakeIdentityValidator { get; } = new();
    public Dictionary<string, string> AppIdOverrides { get; } = new();

    public string ConnectionString => _postgres.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:PostgreSQL", ConnectionString);
        builder.UseSetting("Resolver:BaseUrl", "http://localhost");
        builder.UseSetting("Resolver:EncryptionKey", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==");
        builder.UseSetting("Startup:SkipDatabaseInitialization", "true");

        builder.ConfigureServices(services =>
        {
            // Remove real PostgreSQL registration and replace with test container
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(ConnectionString));

            // Remove real Firebase validator and replace with fake
            services.RemoveAll<IIdentityTokenValidator>();
            services.AddSingleton<IIdentityTokenValidator>(FakeIdentityValidator);

            // Remove FirebaseApp singleton (it fails without credentials)
            services.RemoveAll<FirebaseAdmin.FirebaseApp>();

            // Override AppIdResolver to support WireMock URLs in tests
            services.RemoveAll<OHPP.Infrastructure.DotNet.Http.IAppIdResolver>();
            services.AddSingleton<OHPP.Infrastructure.DotNet.Http.IAppIdResolver>(
                new OHPP.Infrastructure.DotNet.Http.DevModeAppIdResolver(AppIdOverrides));

            // Disable only application background loops. Removing every
            // IHostedService also removes ASP.NET Core's internal web-host
            // service and can leave WebApplicationFactory startup hanging.
            var applicationBackgroundServices = services
                .Where(descriptor =>
                    descriptor.ServiceType == typeof(IHostedService) &&
                    (descriptor.ImplementationType == typeof(ExpiryEnforcementBackgroundService) ||
                     descriptor.ImplementationType == typeof(SseHeartbeatService)))
                .ToArray();

            foreach (var descriptor in applicationBackgroundServices)
                services.Remove(descriptor);
        });

        // The factory owns test-database migration in InitializeAsync. Mark the
        // host explicitly so Program does not synchronously migrate it as well.
        builder.UseEnvironment("Testing");
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // The test host requests the startup skip during configuration.
        // Migrations remain idempotent, and this factory owns the test schema
        // and signing-key seeding.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        await EnsureResolverSigningKeyAsync(scope.ServiceProvider);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    private static async Task EnsureResolverSigningKeyAsync(IServiceProvider services)
    {
        var keyStore = services.GetRequiredService<IKeyStore>();
        if (await keyStore.GetActiveKeyAsync() is not null)
            return;

        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var keyEncryptor = services.GetRequiredService<IKeyEncryptor>();
        var clock = services.GetRequiredService<IClock>();
        await keyStore.CreateKeyAsync(new SigningKey
        {
            KeyId = $"resolver-test-{Guid.NewGuid():N}",
            Algorithm = "ES256",
            PublicKeyPem = key.ExportSubjectPublicKeyInfoPem(),
            PrivateKeyPem = keyEncryptor.Encrypt(key.ExportPkcs8PrivateKeyPem()),
            IsActive = true,
            CreatedAt = clock.UtcNow
        });
    }
}
