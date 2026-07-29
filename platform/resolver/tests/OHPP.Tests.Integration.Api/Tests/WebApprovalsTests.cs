using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class WebApprovalsTests : IntegrationTestBase
{
    public WebApprovalsTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task WebApprovals_NoDevicesWithKeys_ReturnsEnabled()
    {
        var (userClient, _) = await CreateAuthenticatedUserAsync();

        var response = await userClient.GetAsync("/api/web-approvals/status");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("true"); // enabled: true
    }

    [Fact]
    public async Task WebApprovals_DeviceWithKey_ReturnsDisabled()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        // Register a public key on the device
        var (publicKey, _) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });

        var response = await userClient.GetAsync("/api/web-approvals/status");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("false"); // enabled: false
    }

    [Fact]
    public async Task WebApprovals_DeviceWithoutKey_ReturnsEnabled()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId); // Device exists but no key registered

        var response = await userClient.GetAsync("/api/web-approvals/status");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("true"); // enabled: true — device has no key
    }

    [Fact]
    public async Task WebApprovals_GetPending_NoDevices_ReturnsPendingRequests()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId); // Device without key (web approvals still enabled)
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "web-pending.test", "Web App");

        // Submit a participation request
        var payload = BuildProtocolPayload(userId, "web-pending.test");
        await appClient.PostAsJsonAsync("/api/participate", new { payload });

        var response = await userClient.GetAsync("/api/web-approvals/pending");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("web-pending.test");
    }

    [Fact]
    public async Task WebApprovals_GetPending_HasDeviceWithKey_Returns403()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (publicKey, _) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });

        var response = await userClient.GetAsync("/api/web-approvals/pending");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task WebApprovals_Resolve_NoDevices_ApprovesRequest()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "web-resolve.test", "Resolve App");

        // Submit a request
        var payload = BuildProtocolPayload(userId, "web-resolve.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // Approve via web
        var resolveResponse = await userClient.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve",
            new { decision = "approve" });

        resolveResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var resolveBody = await resolveResponse.Content.ReadAsStringAsync();
        resolveBody.Should().Contain("resolved");
    }

    [Fact]
    public async Task WebApprovals_Resolve_HasDeviceWithKey_Returns403()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (publicKey, _) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "web-blocked.test", "Blocked App");

        var payload = BuildProtocolPayload(userId, "web-blocked.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        var response = await userClient.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve",
            new { decision = "approve" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task WebApprovals_Resolve_AlreadyResolved_ReturnsConflict()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "web-dupe.test", "Dupe App");

        var payload = BuildProtocolPayload(userId, "web-dupe.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // First resolve
        await userClient.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve", new { decision = "approve" });

        // Second resolve — should conflict
        var response = await userClient.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve",
            new { decision = "approve" });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task WebApprovals_Resolve_NotOwnedByUser_ReturnsNotFound()
    {
        var (_, userId1) = await CreateAuthenticatedUserAsync();
        var (userClient2, _) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId1);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId1, "web-other.test", "Other App");

        var payload = BuildProtocolPayload(userId1, "web-other.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // User 2 tries to resolve user 1's request
        var response = await userClient2.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve",
            new { decision = "approve" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task WebApprovals_Resolve_AppCanPollResolved()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "web-poll.test", "Poll App");

        var payload = BuildProtocolPayload(userId, "web-poll.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // Approve via web
        await userClient.PostAsJsonAsync($"/api/web-approvals/{requestId}/resolve", new { decision = "approve" });

        // App polls — should be resolved
        var statusResponse = await appClient.GetAsync($"/api/participate/{requestId}/status");
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusBody = await statusResponse.Content.ReadAsStringAsync();
        statusBody.Should().Contain("resolved");
    }

    private static string BuildProtocolPayload(Guid userId, string appId)
    {
        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId },
            validation = new { userId = userId.ToString() },
            action = new { summary = $"Web approval test for {appId}" },
            type = "select",
            options = new[] { new { key = "approve", label = "Approve" }, new { key = "deny", label = "Deny" } },
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        return JsonSerializer.Serialize(request);
    }
}
