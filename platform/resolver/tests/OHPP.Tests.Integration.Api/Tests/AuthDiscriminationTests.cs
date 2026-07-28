using System.Net;
using System.Net.Http.Headers;
using FluentAssertions;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

/// <summary>
/// Tests that the correct token type is required for each endpoint group.
/// Identity tokens work on portal endpoints, device tokens on device endpoints,
/// app tokens on protocol endpoints — and cross-type access is rejected.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class AuthDiscriminationTests : IntegrationTestBase
{
    public AuthDiscriminationTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task IdentityToken_PortalEndpoints_Accepted()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeviceToken_DeviceEndpoints_Accepted()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await deviceClient.GetAsync("/api/devices/me/pending");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AppToken_ParticipateEndpoints_Accepted()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId);

        // GET status for a non-existent request — should get 404 (not 401)
        var response = await appClient.GetAsync($"/api/participate/{Guid.NewGuid()}/status");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeviceToken_OnPortalEndpoint_Rejected()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await deviceClient.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AppToken_OnDeviceEndpoint_Rejected()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId);

        var response = await appClient.GetAsync("/api/devices/me/pending");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task IdentityToken_OnDeviceEndpoint_Rejected()
    {
        var (userClient, _) = await CreateAuthenticatedUserAsync();

        var response = await userClient.GetAsync("/api/devices/me/pending");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task NoToken_OnProtectedEndpoint_Rejected()
    {
        var response = await Client.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task InvalidToken_OnProtectedEndpoint_Rejected()
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "totally_invalid_garbage");

        var response = await client.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
