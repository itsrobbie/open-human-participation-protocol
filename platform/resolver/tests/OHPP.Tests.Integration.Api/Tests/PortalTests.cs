using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class PortalTests : IntegrationTestBase
{
    public PortalTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task GetSummary_AuthenticatedUser_ReturnsSummaryWithCounts()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();

        // Seed a device and an app
        await CreateAuthenticatedDeviceAsync(userId);
        await CreateAuthenticatedAppAsync(userId, "bank.test", "Bank");

        var response = await client.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"activeDevices\":1");
        body.Should().Contain("\"activeApps\":1");
        body.Should().Contain("\"pendingCount\":0");
    }

    [Fact]
    public async Task GetDevices_ReturnsAllDevicesForUser()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        await CreateAuthenticatedDeviceAsync(userId);

        var response = await client.GetAsync("/api/devices");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("integration-test");
    }

    [Fact]
    public async Task CreateDevice_ReturnsDeviceWithToken()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/devices", new { name = "New Phone", deviceType = "ios" });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"name\":\"New Phone\"");
        body.Should().Contain("ohpp_dev_");
    }

    [Fact]
    public async Task RevokeDevice_OwnedDevice_Returns204()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        var (_, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await client.DeleteAsync($"/api/devices/{deviceId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify device is now inactive
        using var scope = Factory.Services.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var device = await repo.GetByIdAsync(deviceId);
        device!.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task RevokeDevice_OtherUsersDevice_Returns404()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();
        var (_, otherUserId) = await CreateAuthenticatedUserAsync();
        var (_, otherDeviceId, _) = await CreateAuthenticatedDeviceAsync(otherUserId);

        var response = await client.DeleteAsync($"/api/devices/{otherDeviceId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetRegisteredApps_ReturnsAppsForUser()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedAppAsync(userId, "app1.test", "App One");
        await CreateAuthenticatedAppAsync(userId, "app2.test", "App Two");

        var response = await client.GetAsync("/api/registrations/apps");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("app1.test");
        body.Should().Contain("app2.test");
    }

    [Fact]
    public async Task RevokeApp_ActiveApp_Returns204_CancelsPending()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        var (_, appRegId, _) = await CreateAuthenticatedAppAsync(userId, "revoke.test", "Revoke Me");

        var response = await client.DeleteAsync($"/api/registrations/apps/{appRegId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify app is revoked
        using var scope = Factory.Services.CreateScope();
        var appRepo = scope.ServiceProvider.GetRequiredService<IAppRegistrationRepository>();
        var app = await appRepo.GetByIdAsync(appRegId);
        app!.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RevokeApp_AlreadyRevoked_Returns409()
    {
        var (client, userId) = await CreateAuthenticatedUserAsync();
        var (_, appRegId, _) = await CreateAuthenticatedAppAsync(userId, "double.test", "Double Revoke");

        // First revoke
        await client.DeleteAsync($"/api/registrations/apps/{appRegId}");

        // Second revoke
        var response = await client.DeleteAsync($"/api/registrations/apps/{appRegId}");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetHistory_EmptyHistory_ReturnsEmptyPage()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.GetAsync("/api/history?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"totalCount\":0");
    }
}
