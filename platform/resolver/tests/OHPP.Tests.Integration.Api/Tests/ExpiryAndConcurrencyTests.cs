using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

/// <summary>
/// Tests for request expiry, concurrent submissions, and race conditions.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class ExpiryAndConcurrencyTests : IntegrationTestBase
{
    public ExpiryAndConcurrencyTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task Participation_RequestExpires_ExpiryServiceMarksExpired()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "expiry.test", "Expiry App");

        // Submit a request with an expiry 1 second from now
        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "expiry.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Will expire" },
            type = "text",
            expiry = DateTimeOffset.UtcNow.AddSeconds(1).ToString("o"),
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        var payload = JsonSerializer.Serialize(request);

        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // Wait for expiry
        await Task.Delay(1500);

        // Manually run the expiry enforcement service (background service is disabled in tests)
        using (var scope = Factory.Services.CreateScope())
        {
            var expiryService = scope.ServiceProvider.GetRequiredService<IExpiryEnforcementService>();
            var expiredCount = await expiryService.EnforceExpiredRequestsAsync();
            expiredCount.Should().BeGreaterThan(0);
        }

        // Poll status — should be expired
        var statusResponse = await appClient.GetAsync($"/api/participate/{requestId}/status");
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusBody = await statusResponse.Content.ReadAsStringAsync();
        statusBody.Should().Contain("expired");
    }

    [Fact]
    public async Task Participation_MultipleConcurrentRequests_SameUser_AllStored()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "concurrent.test", "Concurrent App");

        // Submit 5 requests concurrently
        var tasks = Enumerable.Range(0, 5).Select(i =>
        {
            var request = new
            {
                id = Guid.NewGuid().ToString(),
                version = "1.0",
                requester = new { appId = "concurrent.test" },
                validation = new { userId = userId.ToString() },
                action = new { summary = $"Concurrent request {i}" },
                type = "text",
                createdAt = DateTimeOffset.UtcNow.ToString("o")
            };
            var payload = JsonSerializer.Serialize(request);
            return appClient.PostAsJsonAsync("/api/participate", new { payload });
        }).ToArray();

        var responses = await Task.WhenAll(tasks);

        // All should succeed
        responses.Should().AllSatisfy(r => r.StatusCode.Should().Be(HttpStatusCode.Created));

        // Verify all 5 are pending for the user
        using var scope = Factory.Services.CreateScope();
        var pendingRepo = scope.ServiceProvider.GetRequiredService<IPendingRequestRepository>();
        var pending = await pendingRepo.GetPendingByUserIdAsync(userId);
        pending.Count.Should().BeGreaterThanOrEqualTo(5);
    }

    [Fact]
    public async Task Participation_TwoDevicesRace_FirstAttestationWins_SecondConflict()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();

        // Create two devices with keys
        var (device1Client, device1Id, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (device2Client, device2Id, _) = await CreateAuthenticatedDeviceAsync(userId);

        var (pub1, priv1) = TestCryptoHelper.GenerateEcKeyPair();
        var (pub2, priv2) = TestCryptoHelper.GenerateEcKeyPair();
        await device1Client.PostAsJsonAsync("/api/devices/me/keys", new { publicKey = pub1, algorithm = "ES256" });
        await device2Client.PostAsJsonAsync("/api/devices/me/keys", new { publicKey = pub2, algorithm = "ES256" });

        // Seed resolver key
        using (var scope = Factory.Services.CreateScope())
        {
            var keyStore = scope.ServiceProvider.GetRequiredService<Domain.Attestation.IKeyStore>();
            var keyEncryptor = scope.ServiceProvider.GetRequiredService<Domain.Attestation.IKeyEncryptor>();
            var (rPub, rPriv) = TestCryptoHelper.GenerateEcKeyPair();
            await keyStore.CreateKeyAsync(new Domain.Attestation.SigningKey
            {
                KeyId = "resolver_key_race",
                Algorithm = "ES256",
                PublicKeyPem = rPub,
                PrivateKeyPem = keyEncryptor.Encrypt(rPriv),
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // Submit a request
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "race.test", "Race App");
        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "race.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Race condition test" },
            type = "select",
            options = new[] { new { key = "yes", label = "Yes" }, new { key = "no", label = "No" } },
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        var payload = JsonSerializer.Serialize(request);
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // Both devices attempt attestation concurrently
        var attestPayload1 = JsonSerializer.Serialize(new
        {
            requestId = requestId.ToString(),
            decision = "yes",
            type = "Select",
            method = "Direct",
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        });
        var attestPayload2 = JsonSerializer.Serialize(new
        {
            requestId = requestId.ToString(),
            decision = "no",
            type = "Select",
            method = "Direct",
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        });

        var sig1 = TestCryptoHelper.Sign(attestPayload1, priv1);
        var sig2 = TestCryptoHelper.Sign(attestPayload2, priv2);

        // Send both. The state transition must choose one winner and return a domain conflict
        // for the loser. A database exception or generic server error is never acceptable.
        var task1 = device1Client.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId, attestationPayload = attestPayload1, deviceSignature = sig1
        });
        var task2 = device2Client.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId, attestationPayload = attestPayload2, deviceSignature = sig2
        });

        var results = await Task.WhenAll(task1, task2);

        var statuses = results.Select(r => r.StatusCode).OrderBy(status => status).ToList();
        statuses.Should().BeEquivalentTo(
            new[] { HttpStatusCode.OK, HttpStatusCode.Conflict },
            options => options.WithStrictOrdering(),
            "one device must win and the race loser must receive a deterministic conflict");
    }
}
