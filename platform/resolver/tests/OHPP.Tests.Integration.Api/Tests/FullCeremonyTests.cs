using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

/// <summary>
/// End-to-end participation ceremony: submit request → device fetches pending → device signs → attestation stored → app polls resolved.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class FullCeremonyTests : IntegrationTestBase
{
    public FullCeremonyTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task Participation_FullCeremony_HappyPath()
    {
        // Setup: user, device with key, app
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "ceremony.test", "Ceremony App");

        // Device registers an EC key
        var (publicKey, privateKey) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });

        // Also seed a Resolver signing key for counter-signing
        using (var scope = Factory.Services.CreateScope())
        {
            var keyStore = scope.ServiceProvider.GetRequiredService<IKeyStore>();
            var keyEncryptor = scope.ServiceProvider.GetRequiredService<IKeyEncryptor>();
            var (resolverPub, resolverPriv) = TestCryptoHelper.GenerateEcKeyPair();
            var encryptedPriv = keyEncryptor.Encrypt(resolverPriv);
            await keyStore.CreateKeyAsync(new SigningKey
            {
                KeyId = "resolver_key_ceremony",
                Algorithm = "ES256",
                PublicKeyPem = resolverPub,
                PrivateKeyPem = encryptedPriv,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // Step 1: App submits participation request
        var payload = BuildProtocolPayload(userId, "ceremony.test", "select");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        submitResponse.StatusCode.Should().Be(HttpStatusCode.Created, because: submitBody);
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // Step 2: Device fetches pending requests
        var pendingResponse = await deviceClient.GetAsync("/api/devices/me/pending");
        pendingResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var pendingBody = await pendingResponse.Content.ReadAsStringAsync();
        pendingBody.Should().Contain(requestId.ToString());

        // Step 3: Device signs and submits attestation
        var attestationPayload = JsonSerializer.Serialize(new
        {
            requestId = requestId.ToString(),
            decision = "approve",
            type = "Select",
            method = "Direct",
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        });
        var deviceSignature = TestCryptoHelper.Sign(attestationPayload, privateKey);

        var attestResponse = await deviceClient.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId,
            attestationPayload,
            deviceSignature
        });
        var attestBody = await attestResponse.Content.ReadAsStringAsync();
        attestResponse.StatusCode.Should().Be(HttpStatusCode.OK, because: attestBody);
        attestBody.Should().Contain("attestation");

        // Step 4: App polls status — should be resolved
        var statusResponse = await appClient.GetAsync($"/api/participate/{requestId}/status");
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusBody = await statusResponse.Content.ReadAsStringAsync();
        statusBody.Should().Contain("resolved");
    }

    [Fact]
    public async Task Participation_DuplicateAttestation_SecondRejected()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "dupe-attest.test", "Dupe");

        var (publicKey, privateKey) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });

        using (var scope = Factory.Services.CreateScope())
        {
            var keyStore = scope.ServiceProvider.GetRequiredService<IKeyStore>();
            var keyEncryptor = scope.ServiceProvider.GetRequiredService<IKeyEncryptor>();
            var (rPub, rPriv) = TestCryptoHelper.GenerateEcKeyPair();
            var encryptedPriv = keyEncryptor.Encrypt(rPriv);
            await keyStore.CreateKeyAsync(new SigningKey
            {
                KeyId = "resolver_key_dupe",
                Algorithm = "ES256",
                PublicKeyPem = rPub,
                PrivateKeyPem = encryptedPriv,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // Submit
        var payload = BuildProtocolPayload(userId, "dupe-attest.test", "text");
        var submitResponse = await appClient.PostAsJsonAsync("/api/participate", new { payload });
        var submitBody = await submitResponse.Content.ReadAsStringAsync();
        var requestId = JsonDocument.Parse(submitBody).RootElement.GetProperty("requestId").GetGuid();

        // First attestation
        var attestPayload = JsonSerializer.Serialize(new
        {
            requestId = requestId.ToString(),
            decision = "confirmed",
            type = "Text",
            method = "Direct",
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        });
        var sig = TestCryptoHelper.Sign(attestPayload, privateKey);

        var first = await deviceClient.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId, attestationPayload = attestPayload, deviceSignature = sig
        });
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        // Second attestation — same request, already resolved
        var second = await deviceClient.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId, attestationPayload = attestPayload, deviceSignature = sig
        });
        second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var secondBody = await second.Content.ReadAsStringAsync();
        secondBody.Should().Contain("Resolved");
    }

    private static string BuildProtocolPayload(Guid userId, string appId, string type)
    {
        var request = new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId },
            validation = new { userId = userId.ToString() },
            action = new { summary = $"Test action for {appId}" },
            type,
            options = type == "select"
                ? new[] { new { key = "approve", label = "Approve" }, new { key = "deny", label = "Deny" } }
                : null,
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        return JsonSerializer.Serialize(request);
    }
}
