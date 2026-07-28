using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.PostgreSQL;
using Xunit;

namespace OHPP.Tests.Integration.Api.Infrastructure;

/// <summary>
/// Base class for integration tests providing helpers for auth tokens, seeding data,
/// and making authenticated HTTP requests.
/// </summary>
public abstract class IntegrationTestBase : IClassFixture<TestWebApplicationFactory>
{
    protected readonly TestWebApplicationFactory Factory;
    protected readonly HttpClient Client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    protected IntegrationTestBase(TestWebApplicationFactory factory)
    {
        Factory = factory;
        Client = factory.CreateClient();
    }

    // --- Auth helpers ---

    /// <summary>
    /// Creates an identity token (simulates Firebase) and returns a client with the Bearer header set.
    /// Also ensures the user exists in the database.
    /// Token format mimics JWT structure so TokenDiscriminationService recognizes it.
    /// </summary>
    protected async Task<(HttpClient Client, Guid UserId)> CreateAuthenticatedUserAsync(
        string? externalId = null, string? email = null)
    {
        externalId ??= Guid.NewGuid().ToString("N");
        email ??= $"{externalId}@test.ohpp.dev";

        // Token must look like a JWT (eyJ + 3 dot-separated parts) for TokenDiscriminationService
        var payload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
            $"{{\"sub\":\"{externalId}\",\"email\":\"{email}\"}}"));
        var token = $"eyJhbGciOiJ0ZXN0In0.{payload}.test_signature_{externalId}";

        // Register this token with the fake validator
        Factory.FakeIdentityValidator.RegisterToken(token, new IdentityTokenClaims
        {
            ExternalId = externalId,
            Email = email,
            DisplayName = $"Test User {externalId[..8]}"
        });

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Make a request to trigger user creation via token resolution
        var response = await client.PostAsync("/api/users/me", null);

        // If the endpoint failed, the user might not exist yet — check response
        if (!response.IsSuccessStatusCode)
        {
            // Fallback: user was created during token resolution even if endpoint returned error.
            // The middleware resolves the token (creating user) before the action filter runs.
        }

        // Retrieve the user ID
        using var scope = Factory.Services.CreateScope();
        var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var user = await userRepo.GetByExternalIdAsync(externalId);

        if (user is null)
            throw new InvalidOperationException(
                $"User with externalId '{externalId}' was not created. POST /api/users/me returned {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        return (client, user.Id);
    }

    /// <summary>
    /// Creates a device for the given user and returns a client authenticated with the device token.
    /// </summary>
    protected async Task<(HttpClient Client, Guid DeviceId, string DeviceToken)> CreateAuthenticatedDeviceAsync(Guid userId)
    {
        using var scope = Factory.Services.CreateScope();
        var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var tokenGenerator = scope.ServiceProvider.GetRequiredService<ITokenGenerator>();

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = "Test Device",
            DeviceType = "integration-test",
            DeviceToken = tokenGenerator.GenerateDeviceToken(),
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };
        await deviceRepo.CreateAsync(device);

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", device.DeviceToken);

        return (client, device.Id, device.DeviceToken);
    }

    /// <summary>
    /// Creates an app registration for the given user and returns a client authenticated with the app access token.
    /// </summary>
    protected async Task<(HttpClient Client, Guid AppRegistrationId, string AccessToken)> CreateAuthenticatedAppAsync(
        Guid userId, string appId = "test.example.com", string appName = "Test App")
    {
        using var scope = Factory.Services.CreateScope();
        var appRepo = scope.ServiceProvider.GetRequiredService<IAppRegistrationRepository>();
        var tokenGenerator = scope.ServiceProvider.GetRequiredService<ITokenGenerator>();

        var registration = new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AppId = appId,
            AppName = appName,
            AccessToken = tokenGenerator.GenerateAppAccessToken(),
            ResolverBaseUrl = "http://localhost",
            RegisteredAt = DateTimeOffset.UtcNow
        };
        await appRepo.CreateAsync(registration);

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", registration.AccessToken);

        return (client, registration.Id, registration.AccessToken);
    }

    // --- DB helpers ---

    protected async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await action(db);
    }

    protected async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(db);
    }

    // --- JSON helpers ---

    protected static async Task<T?> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(content, JsonOptions);
    }
}
