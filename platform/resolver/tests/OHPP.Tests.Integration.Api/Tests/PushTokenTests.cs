using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class PushTokenTests : IntegrationTestBase
{
    public PushTokenTests(TestWebApplicationFactory factory) : base(factory) { }

    // --- Happy path ---

    [Fact]
    public async Task RegisterPushToken_ValidToken_StoresOnDevice()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "fcm_valid_token_abc123",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"pushTokenRegistered\":true");

        // Verify it persisted
        using var scope = Factory.Services.CreateScope();
        var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var device = await deviceRepo.GetByIdAsync(deviceId);
        device!.PushToken.Should().Be("fcm_valid_token_abc123");
    }

    [Fact]
    public async Task RegisterPushToken_ReplacesExistingToken()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Register first token
        await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "old_token_123",
        });

        // Register replacement token
        var response = await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "new_token_456",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify the new token replaced the old one
        using var scope = Factory.Services.CreateScope();
        var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var device = await deviceRepo.GetByIdAsync(deviceId);
        device!.PushToken.Should().Be("new_token_456");
    }

    [Fact]
    public async Task RegisterPushToken_EmptyPrevious_SetsNew()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Device starts with no push token (default)
        using (var scope = Factory.Services.CreateScope())
        {
            var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
            var device = await deviceRepo.GetByIdAsync(deviceId);
            device!.PushToken.Should().BeNull();
        }

        // Register token
        var response = await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "first_token_ever",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
            var device = await deviceRepo.GetByIdAsync(deviceId);
            device!.PushToken.Should().Be("first_token_ever");
        }
    }

    // --- Non-happy path ---

    [Fact]
    public async Task RegisterPushToken_EmptyString_Returns400()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "",
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("token is required");
    }

    [Fact]
    public async Task RegisterPushToken_RevokedDevice_Returns401()
    {
        // A device that has been revoked (IsActive = false) must fail authentication
        // BEFORE the controller runs. The auth layer returns Unauthorized ("Device has
        // been revoked"), so the request never reaches the push-token endpoint's own
        // validation. This is the real contract: a revoked device token is rejected.
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Revoke the device so its token no longer authenticates.
        using (var scope = Factory.Services.CreateScope())
        {
            var deviceRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
            var devices = await deviceRepo.GetActiveByUserIdAsync(userId);
            foreach (var device in devices)
            {
                device.IsActive = false;
                await deviceRepo.UpdateAsync(device);
            }
        }

        var response = await deviceClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "some_fcm_token",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RegisterPushToken_InvalidAuth_Returns401()
    {
        var (userClient, _) = await CreateAuthenticatedUserAsync();

        // Identity token (not device token) should be rejected
        var response = await userClient.PostAsJsonAsync("/api/devices/me/push-token", new
        {
            token = "some_fcm_token",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
