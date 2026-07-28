using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using OHPP.Domain.Auth;
using OHPP.Infrastructure.PostgreSQL;
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

            // Remove background services to avoid interference during tests
            services.RemoveAll<IHostedService>();
        });

        builder.UseEnvironment("Development");
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Apply migrations to the test database
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }
}
