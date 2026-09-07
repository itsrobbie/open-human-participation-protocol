using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class NotificationPreferencesTests : IntegrationTestBase
{
    public NotificationPreferencesTests(TestWebApplicationFactory factory) : base(factory) { }

    // --- Happy path ---

    [Fact]
    public async Task GetPreferences_ReturnsPerAppPrefs()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedAppAsync(userId, "prefs-app.test", "Prefs App");

        // Set a preference first
        await client.PutAsJsonAsync("/api/notification-preferences/prefs-app.test", new
        {
            pushEnabled = true,
            soundEnabled = false,
            badgeEnabled = true,
        });

        var response = await client.GetAsync("/api/notification-preferences");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"appId\":\"prefs-app.test\"");
        body.Should().Contain("\"pushEnabled\":true");
        body.Should().Contain("\"soundEnabled\":false");
        body.Should().Contain("\"badgeEnabled\":true");
    }

    [Fact]
    public async Task GetPreferences_NoPrefsSet_ReturnsEmptyDefaults()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.GetAsync("/api/notification-preferences");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Be("[]");
    }

    [Fact]
    public async Task UpdatePreference_ValidPayload_Returns200()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedAppAsync(userId, "update-prefs.test", "Update Prefs App");

        var response = await client.PutAsJsonAsync("/api/notification-preferences/update-prefs.test", new
        {
            pushEnabled = true,
            soundEnabled = true,
            badgeEnabled = true,
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"appId\":\"update-prefs.test\"");
        body.Should().Contain("\"pushEnabled\":true");
    }

    [Fact]
    public async Task UpdatePreference_DisablePush_StoresFalse()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedAppAsync(userId, "disable-push.test", "Disable Push App");

        var response = await client.PutAsJsonAsync("/api/notification-preferences/disable-push.test", new
        {
            pushEnabled = false,
            soundEnabled = false,
            badgeEnabled = false,
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"pushEnabled\":false");
        body.Should().Contain("\"soundEnabled\":false");
        body.Should().Contain("\"badgeEnabled\":false");

        // Verify it persisted via GET
        var getResponse = await client.GetAsync("/api/notification-preferences");
        var getBody = await getResponse.Content.ReadAsStringAsync();
        getBody.Should().Contain("\"pushEnabled\":false");
    }

    // --- Non-happy path ---

    [Fact]
    public async Task UpdatePreference_UnregisteredApp_Returns404()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PutAsJsonAsync("/api/notification-preferences/nonexistent.app", new
        {
            pushEnabled = true,
            soundEnabled = true,
            badgeEnabled = true,
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("No active registration found");
    }

    [Fact]
    public async Task UpdatePreference_InvalidPayload_Returns400()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedAppAsync(userId, "bad-payload.test", "Bad Payload App");

        // Send completely invalid JSON body
        var response = await client.PutAsync(
            "/api/notification-preferences/bad-payload.test",
            new StringContent("not json", System.Text.Encoding.UTF8, "application/json"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetPreferences_InvalidToken_Returns401()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Device tokens should not access notification preferences (requires IdentityProvider token)
        var response = await deviceClient.GetAsync("/api/notification-preferences");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdatePreference_OtherUsersApp_Returns404()
    {
        var (client1, userId1) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        // User 1 has an app registered
        await CreateAuthenticatedAppAsync(userId1, "user1-app.test", "User1 App");

        // User 2 tries to update preferences for User 1's app
        var response = await client2.PutAsJsonAsync("/api/notification-preferences/user1-app.test", new
        {
            pushEnabled = false,
            soundEnabled = false,
            badgeEnabled = false,
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
