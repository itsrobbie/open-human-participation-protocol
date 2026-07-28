using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class DeviceFlowTests : IntegrationTestBase
{
    public DeviceFlowTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task DeviceRegistration_FullFlow_CreateDevice_RegisterKey()
    {
        // Portal creates a device
        var (userClient, userId) = await CreateAuthenticatedUserAsync();

        var createResponse = await userClient.PostAsJsonAsync("/api/devices", new { name = "Test Phone", deviceType = "ios" });
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var createBody = await createResponse.Content.ReadAsStringAsync();
        var deviceToken = System.Text.Json.JsonDocument.Parse(createBody)
            .RootElement.GetProperty("deviceToken").GetString()!;

        // CLI connects with device token and registers a key
        var deviceClient = Factory.CreateClient();
        deviceClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", deviceToken);

        var keyResponse = await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new
        {
            publicKey = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----",
            algorithm = "ES256"
        });

        keyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var keyBody = await keyResponse.Content.ReadAsStringAsync();
        keyBody.Should().Contain("keyRegistered");
    }

    [Fact]
    public async Task RevokedDevice_TokenRejected()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Verify device works
        var beforeRevoke = await deviceClient.GetAsync("/api/devices/me/pending");
        beforeRevoke.StatusCode.Should().Be(HttpStatusCode.OK);

        // Revoke through portal
        await userClient.DeleteAsync($"/api/devices/{deviceId}");

        // Device token should now be rejected
        var afterRevoke = await deviceClient.GetAsync("/api/devices/me/pending");
        afterRevoke.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RevokedApp_FutureRequests_Rejected()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, appRegId, _) = await CreateAuthenticatedAppAsync(userId, "revoke-flow.test", "Revoke Flow");

        // Revoke through portal
        await userClient.DeleteAsync($"/api/registrations/apps/{appRegId}");

        // App token should now be rejected at auth level
        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            type = "text",
            summary = "Should be rejected"
        });
        var response = await appClient.PostAsJsonAsync("/api/participate", new { payload });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPendingRequests_DeviceToken_ReturnsUsersPendingRequests()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "pending.test", "Pending App");

        // Submit a participation request with correct protocol format
        var request = new
        {
            id = System.Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "pending.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Pending for device" },
            type = "select",
            options = new[] { new { key = "yes", label = "Yes" }, new { key = "no", label = "No" } },
            createdAt = System.DateTimeOffset.UtcNow.ToString("o")
        };
        var payload = System.Text.Json.JsonSerializer.Serialize(request);
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);

        // Device checks pending
        var pendingResponse = await deviceClient.GetAsync("/api/devices/me/pending");

        pendingResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await pendingResponse.Content.ReadAsStringAsync();
        body.Should().Contain("Pending for device");
    }
}
