using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

/// <summary>
/// Test 10: Participation_FullCeremony_ViaRequesterSdk.
/// Uses the OHPP.Sdk (Requester SDK) end-to-end against the real Resolver.
/// Proves: SDK challenge → register → send request → poll result.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class RequesterSdkCeremonyTests : IntegrationTestBase
{
    public RequesterSdkCeremonyTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task Participation_FullCeremony_ViaRequesterSdk()
    {
        // Setup: user, device with key
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, deviceId, _) = await CreateAuthenticatedDeviceAsync(userId);
        var (_, appRegistrationId, accessToken) = await CreateAuthenticatedAppAsync(userId, "sdk-test.test", "SDK Test App");

        // Device registers an EC key
        var (publicKey, privateKey) = TestCryptoHelper.GenerateEcKeyPair();
        await deviceClient.PostAsJsonAsync("/api/devices/me/keys", new { publicKey, algorithm = "ES256" });

        // Seed a Resolver signing key for counter-signing
        using (var scope = Factory.Services.CreateScope())
        {
            var keyStore = scope.ServiceProvider.GetRequiredService<IKeyStore>();
            var keyEncryptor = scope.ServiceProvider.GetRequiredService<IKeyEncryptor>();
            var (resolverPub, resolverPriv) = TestCryptoHelper.GenerateEcKeyPair();
            var encryptedPriv = keyEncryptor.Encrypt(resolverPriv);
            await keyStore.CreateKeyAsync(new SigningKey
            {
                KeyId = "resolver_key_sdk_test",
                Algorithm = "ES256",
                PublicKeyPem = resolverPub,
                PrivateKeyPem = encryptedPriv,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // --- Use the SDK to build and send a participation request ---
        var sdkHttpClient = Factory.CreateClient();
        var discovery = new EndpointDiscovery(sdkHttpClient);
        var requesterClient = new OhppRequesterClient(sdkHttpClient, discovery);

        // Build a request using the fluent builder
        var request = new ParticipationRequestBuilder()
            .ForUser(userId.ToString())
            .FromApp("sdk-test.test")
            .WithSummary("Confirm SDK integration test")
            .WithDescription("This request was built using ParticipationRequestBuilder")
            .WithCategory("test")
            .OfType(RequestType.Select)
            .AddOption("approve", "Approve")
            .AddOption("deny", "Deny")
            .ExpiresIn(TimeSpan.FromMinutes(5))
            .Build();

        // Send via SDK
        var resolverBaseUrl = Factory.Server.BaseAddress.ToString().TrimEnd('/');
        var sendResult = await requesterClient.SendRequestAsync(request, resolverBaseUrl, accessToken);
        sendResult.Success.Should().BeTrue(because: sendResult.Error ?? "no error");
        sendResult.RequestId.Should().NotBeNullOrWhiteSpace();

        // Poll status via SDK — should be pending
        var statusResult = await requesterClient.GetStatusAsync(sendResult.RequestId!, resolverBaseUrl, accessToken);
        statusResult.Success.Should().BeTrue();
        statusResult.Status.Should().Be(RequestStatus.Pending);

        // Device fetches pending and signs
        var pendingResponse = await deviceClient.GetAsync("/api/devices/me/pending");
        pendingResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var pendingBody = await pendingResponse.Content.ReadAsStringAsync();
        pendingBody.Should().Contain(sendResult.RequestId);

        // Device submits attestation
        var attestPayload = JsonSerializer.Serialize(new
        {
            requestId = sendResult.RequestId,
            decision = "approve",
            type = "Select",
            method = "Direct",
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        });
        var signature = TestCryptoHelper.Sign(attestPayload, privateKey);

        var attestResponse = await deviceClient.PostAsJsonAsync("/api/devices/me/attestations", new
        {
            requestId = Guid.Parse(sendResult.RequestId!),
            attestationPayload = attestPayload,
            deviceSignature = signature
        });
        var attestBody = await attestResponse.Content.ReadAsStringAsync();
        attestResponse.StatusCode.Should().Be(HttpStatusCode.OK, because: attestBody);

        // Poll status via SDK — should now be resolved
        var resolvedResult = await requesterClient.GetStatusAsync(sendResult.RequestId!, resolverBaseUrl, accessToken);
        resolvedResult.Success.Should().BeTrue();
        resolvedResult.Status.Should().Be(RequestStatus.Resolved);

        // Cancel should fail (already resolved)
        var cancelResult = await requesterClient.CancelRequestAsync(sendResult.RequestId!, resolverBaseUrl, accessToken);
        cancelResult.Success.Should().BeFalse();
    }
}
