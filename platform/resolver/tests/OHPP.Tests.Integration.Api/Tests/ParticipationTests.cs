using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Participation;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class ParticipationTests : IntegrationTestBase
{
    public ParticipationTests(TestWebApplicationFactory factory) : base(factory) { }

    private static string BuildValidPayload(Guid userId, string appId, string type = "select")
    {
        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Approve transfer of $500" },
            type,
            options = type == "select"
                ? new[] { new { key = "approve", label = "Approve" }, new { key = "deny", label = "Deny" } }
                : null,
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        return JsonSerializer.Serialize(request);
    }

    [Fact]
    public async Task SubmitRequest_ValidPayload_Returns201WithRequestId()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "bank.test", "Bank");

        var payload = BuildValidPayload(userId, "bank.test");
        var response = await appClient.PostAsJsonAsync("/api/participate", new { payload });

        var body = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.Created, because: body);
        body.Should().Contain("requestId");
    }

    [Fact]
    public async Task SubmitRequest_ExpiredExpiry_ReturnsBadRequest()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "expired.test", "Expired");

        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "expired.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Already expired" },
            type = "select",
            options = new[] { new { key = "a", label = "A" }, new { key = "b", label = "B" } },
            expiry = DateTimeOffset.UtcNow.AddMinutes(-5).ToString("o"),
            createdAt = DateTimeOffset.UtcNow.AddMinutes(-10).ToString("o")
        };
        var payload = JsonSerializer.Serialize(request);

        var response = await appClient.PostAsJsonAsync("/api/participate", new { payload });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetStatus_PendingRequest_ReturnsPending()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "status.test", "Status App");

        var payload = BuildValidPayload(userId, "status.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        var statusResponse = await appClient.GetAsync($"/api/participate/{requestId}/status");

        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusBody = await statusResponse.Content.ReadAsStringAsync();
        statusBody.Should().Contain("pending");
    }

    [Fact]
    public async Task GetStatus_NonExistentRequest_Returns404()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId);

        var response = await appClient.GetAsync($"/api/participate/{Guid.NewGuid()}/status");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CancelRequest_PendingRequest_ReturnsOk()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "cancel.test", "Cancel App");

        var payload = BuildValidPayload(userId, "cancel.test");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        var cancelResponse = await appClient.PostAsync($"/api/participate/{requestId}/cancel", null);

        cancelResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var cancelBody = await cancelResponse.Content.ReadAsStringAsync();
        cancelBody.Should().Contain("cancelled");
    }

    [Fact]
    public async Task CancelRequest_AlreadyCancelled_ReturnsConflict()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "dblcancel.test", "DblCancel");

        var payload = BuildValidPayload(userId, "dblcancel.test", "text");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        await appClient.PostAsync($"/api/participate/{requestId}/cancel", null);
        var secondCancel = await appClient.PostAsync($"/api/participate/{requestId}/cancel", null);

        secondCancel.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetStatus_WrongApp_ReturnsNotFound()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient1, _, _) = await CreateAuthenticatedAppAsync(userId, "app1.test", "App1");
        var (appClient2, _, _) = await CreateAuthenticatedAppAsync(userId, "app2.test", "App2");

        var payload = BuildValidPayload(userId, "app1.test");
        var submitResponse = await appClient1.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        var statusResponse = await appClient2.GetAsync($"/api/participate/{requestId}/status");

        statusResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RevokedApp_SubmitRequest_ReturnsUnauthorized()
    {
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, appRegId, _) = await CreateAuthenticatedAppAsync(userId, "revoked-app.test", "Revoked");

        await userClient.DeleteAsync($"/api/registrations/apps/{appRegId}");

        var payload = BuildValidPayload(userId, "revoked-app.test", "text");
        var response = await appClient.PostAsJsonAsync("/api/participate", new { payload });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
