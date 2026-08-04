using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.PostgreSQL;

namespace OHPP.Presentation.Api.BackgroundServices;

/// <summary>
/// Initializes the Resolver database before the web host begins accepting
/// requests. Keeping this work in an async hosted service leaves Program's
/// entry point synchronously discoverable by WebApplicationFactory.
/// </summary>
public sealed class DatabaseInitializationHostedService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;

    public DatabaseInitializationHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (_configuration.GetValue<bool>("Startup:SkipDatabaseInitialization"))
            return;

        using var scope = _scopeFactory.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(cancellationToken);

        var keyStore = services.GetRequiredService<IKeyStore>();
        if (await keyStore.GetActiveKeyAsync(cancellationToken) is not null)
            return;

        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var keyEncryptor = services.GetRequiredService<IKeyEncryptor>();
        var clock = services.GetRequiredService<IClock>();
        await keyStore.CreateKeyAsync(new SigningKey
        {
            KeyId = $"resolver-{Guid.NewGuid():N}",
            Algorithm = "ES256",
            PublicKeyPem = key.ExportSubjectPublicKeyInfoPem(),
            PrivateKeyPem = keyEncryptor.Encrypt(key.ExportPkcs8PrivateKeyPem()),
            IsActive = true,
            CreatedAt = clock.UtcNow
        }, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
