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

    // 3.1 gap: duplicate-install dedup. The same physical device (same stable
    // DeviceIdentifier) re-registering must reactivate the SAME device row, not
    // create a second one.
    [Fact]
    public async Task CreateDevice_SameIdentifier_DedupsToSameDeviceRow()
    {
        var (userClient, _) = await CreateAuthenticatedUserAsync();
        const string installId = "install-dedup-abc123";

        var first = await userClient.PostAsJsonAsync("/api/devices",
            new { name = "Phone", deviceType = "ios", deviceIdentifier = installId });
        first.StatusCode.Should().Be(HttpStatusCode.Created);
        var firstId = System.Text.Json.JsonDocument.Parse(await first.Content.ReadAsStringAsync())
            .RootElement.GetProperty("id").GetString();

        var second = await userClient.PostAsJsonAsync("/api/devices",
            new { name = "Phone (reinstalled)", deviceType = "ios", deviceIdentifier = installId });
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        var secondId = System.Text.Json.JsonDocument.Parse(await second.Content.ReadAsStringAsync())
            .RootElement.GetProperty("id").GetString();

        secondId.Should().Be(firstId,
            because: "re-registering the same install id must reuse the device row, not duplicate it");

        // And the user has exactly one active device, not two.
        var list = await userClient.GetAsync("/api/devices");
        var listBody = await list.Content.ReadAsStringAsync();
        System.Text.Json.JsonDocument.Parse(listBody).RootElement.GetArrayLength()
            .Should().Be(1, because: "a reinstall must not leave two device rows");
    }

    // 3.1 gap: stale-token re-registration. Re-registering the same install id
    // rotates the device token; the OLD token must stop working and the NEW one
    // must work (the ensureRegistered / reactivate path).
    [Fact]
    public async Task CreateDevice_Reregister_RotatesToken_OldTokenRejected()
    {
        var (userClient, _) = await CreateAuthenticatedUserAsync();
        const string installId = "install-rotate-xyz789";

        var first = await userClient.PostAsJsonAsync("/api/devices",
            new { name = "Phone", deviceType = "ios", deviceIdentifier = installId });
        var oldToken = System.Text.Json.JsonDocument.Parse(await first.Content.ReadAsStringAsync())
            .RootElement.GetProperty("deviceToken").GetString()!;

        // Old token works before re-registration.
        var oldClientBefore = Factory.CreateClient();
        oldClientBefore.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", oldToken);
        (await oldClientBefore.GetAsync("/api/devices/me/pending")).StatusCode
            .Should().Be(HttpStatusCode.OK);

        // Re-register the same install id: token rotates.
        var second = await userClient.PostAsJsonAsync("/api/devices",
            new { name = "Phone", deviceType = "ios", deviceIdentifier = installId });
        var newToken = System.Text.Json.JsonDocument.Parse(await second.Content.ReadAsStringAsync())
            .RootElement.GetProperty("deviceToken").GetString()!;

        newToken.Should().NotBe(oldToken, because: "re-registration rotates the device token");

        // Old (stale) token is now rejected.
        var oldClientAfter = Factory.CreateClient();
        oldClientAfter.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", oldToken);
        (await oldClientAfter.GetAsync("/api/devices/me/pending")).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized,
                because: "the rotated-out token must no longer authenticate");

        // New token works.
        var newClient = Factory.CreateClient();
        newClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", newToken);
        (await newClient.GetAsync("/api/devices/me/pending")).StatusCode
            .Should().Be(HttpStatusCode.OK, because: "the freshly rotated token must authenticate");
    }
}
