using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure;
using OHPP.Cli.Presentation;
using OHPP.Cli.Services;
using OHPP.Domain.Attestation;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class CliCeremonyTests : IntegrationTestBase
{
    public CliCeremonyTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task CliCeremony_RegistersKey_ReceivesRequest_SignsAndResolves()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (_, _, deviceToken) = await CreateAuthenticatedDeviceAsync(userId);
        var keyPair = new Es256KeyPairGenerator().Generate();
        var config = new CliConfig
        {
            DeviceToken = deviceToken,
            ResolverUrl = "http://localhost",
            PublicKeyPem = keyPair.PublicKeyPem,
            PrivateKeyPem = keyPair.PrivateKeyPem
        };
        var cli = new HttpResolverClient(Factory.CreateClient(), config);
        (await cli.RegisterPublicKeyAsync(keyPair.PublicKeyPem, "ES256")).Should().BeTrue();
        await SeedResolverKeyAsync();

        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "cli-ceremony.test", "CLI Ceremony");
        var requestPayload = JsonSerializer.Serialize(new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "cli-ceremony.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Approve through CLI", description = "Real CLI HTTP path" },
            type = "select",
            options = new[]
            {
                new { key = "approve", label = "Approve" },
                new { key = "deny", label = "Deny" }
            },
            createdAt = DateTimeOffset.UtcNow.ToString("O")
        });
        var submitted = await appClient.PostAsJsonAsync("/api/participate", new { payload = requestPayload });
        submitted.StatusCode.Should().Be(HttpStatusCode.Created);
        var requestId = JsonDocument.Parse(await submitted.Content.ReadAsStringAsync())
            .RootElement.GetProperty("requestId").GetGuid();

        var pending = await cli.GetPendingRequestsAsync();
        pending.Should().NotBeNull();
        var incoming = pending!.Should().ContainSingle(request => request.RequestId == requestId).Subject;
        incoming.Options.Should().Contain(option => option.Key == "approve");

        var output = new StringWriter();
        var handler = new CliRequestHandler(new StringReader("1\n"), output, new AttestationBuilder());
        (await handler.HandleAsync(incoming, config, cli)).Should().BeTrue();
        output.ToString().Should().Contain("Attestation submitted.");

        var status = await appClient.GetAsync($"/api/participate/{requestId}/status");
        status.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusBody = await status.Content.ReadAsStringAsync();
        statusBody.Should().Contain("resolved");
        statusBody.Should().Contain("attestation");
    }

    /// <summary>
    /// Tests the CLI's real-world setup flow: authenticate as a user, create a device
    /// via the HTTP API (same as Program.cs does), then verify pending requests are visible.
    /// This catches the bug where the CLI registers but can't see requests.
    /// </summary>
    [Fact]
    public async Task CliSetup_CreatesDeviceViaApi_FetchesPendingRequests()
    {
        // Step 1: Create a user (simulates Keycloak login producing an identity token)
        var (userClient, userId) = await CreateAuthenticatedUserAsync();

        // Step 2: Create a device via the HTTP API (same path as CLI Program.cs)
        var deviceResponse = await userClient.PostAsJsonAsync("/api/devices", new
        {
            name = "CLI Integration Test",
            deviceType = "cli"
        });
        deviceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var deviceJson = JsonDocument.Parse(await deviceResponse.Content.ReadAsStringAsync());
        var deviceToken = deviceJson.RootElement.GetProperty("deviceToken").GetString()!;
        deviceToken.Should().StartWith("ohpp_dev_");

        // Step 3: Use the device token (same as CLI does after setup)
        var keyPair = new Es256KeyPairGenerator().Generate();
        var config = new CliConfig
        {
            DeviceToken = deviceToken,
            ResolverUrl = "http://localhost",
            PublicKeyPem = keyPair.PublicKeyPem,
            PrivateKeyPem = keyPair.PrivateKeyPem
        };
        var cli = new HttpResolverClient(Factory.CreateClient(), config);
        (await cli.RegisterPublicKeyAsync(keyPair.PublicKeyPem, "ES256")).Should().BeTrue();

        // Step 4: Create a pending request (an app sends one for this user)
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "cli-setup.test", "CLI Setup Test");
        var requestPayload = JsonSerializer.Serialize(new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "cli-setup.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "CLI setup verification", description = "Verifies the CLI can see requests after self-registration" },
            type = "select",
            options = new[]
            {
                new { key = "yes", label = "Yes" },
                new { key = "no", label = "No" }
            },
            createdAt = DateTimeOffset.UtcNow.ToString("O")
        });
        var submitted = await appClient.PostAsJsonAsync("/api/participate", new { payload = requestPayload });
        submitted.StatusCode.Should().Be(HttpStatusCode.Created);
        var requestId = JsonDocument.Parse(await submitted.Content.ReadAsStringAsync())
            .RootElement.GetProperty("requestId").GetGuid();

        // Step 5: CLI fetches pending — it MUST see the request
        var pending = await cli.GetPendingRequestsAsync();
        pending.Should().NotBeNull();
        pending!.Should().Contain(r => r.RequestId == requestId,
            "the CLI device belongs to the same user who received the request");
        var found = pending!.First(r => r.RequestId == requestId);
        found.AppId.Should().Be("cli-setup.test");
        found.Summary.Should().Be("CLI setup verification");
        found.Options.Should().HaveCount(2);
    }

    /// <summary>
    /// Tests the exact scenario the user hit: a request is created BEFORE the CLI device
    /// exists, then the CLI registers and should still see the pending request.
    /// </summary>
    [Fact]
    public async Task CliSetup_RequestCreatedBeforeDevice_StillVisibleAfterRegistration()
    {
        // Step 1: Create user and app
        var (userClient, userId) = await CreateAuthenticatedUserAsync();
        var (appClient, _, _) = await CreateAuthenticatedAppAsync(userId, "cli-timing.test", "CLI Timing");

        // Step 2: App sends a request BEFORE any CLI device exists
        var requestPayload = JsonSerializer.Serialize(new
        {
            id = Guid.NewGuid().ToString(),
            version = "1.0",
            requester = new { appId = "cli-timing.test" },
            validation = new { userId = userId.ToString() },
            action = new { summary = "Pre-existing request" },
            type = "select",
            options = new[] { new { key = "ok", label = "OK" } },
            createdAt = DateTimeOffset.UtcNow.ToString("O")
        });
        var submitted = await appClient.PostAsJsonAsync("/api/participate", new { payload = requestPayload });
        submitted.StatusCode.Should().Be(HttpStatusCode.Created);
        var requestId = JsonDocument.Parse(await submitted.Content.ReadAsStringAsync())
            .RootElement.GetProperty("requestId").GetGuid();

        // Step 3: NOW the CLI registers (after the request already exists)
        var deviceResponse = await userClient.PostAsJsonAsync("/api/devices", new
        {
            name = "Late CLI Device",
            deviceType = "cli"
        });
        deviceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var deviceJson = JsonDocument.Parse(await deviceResponse.Content.ReadAsStringAsync());
        var deviceToken = deviceJson.RootElement.GetProperty("deviceToken").GetString()!;

        var keyPair = new Es256KeyPairGenerator().Generate();
        var config = new CliConfig
        {
            DeviceToken = deviceToken,
            ResolverUrl = "http://localhost",
            PublicKeyPem = keyPair.PublicKeyPem,
            PrivateKeyPem = keyPair.PrivateKeyPem
        };
        var cli = new HttpResolverClient(Factory.CreateClient(), config);

        // Step 4: CLI fetches pending — the pre-existing request MUST be visible
        var pending = await cli.GetPendingRequestsAsync();
        pending.Should().NotBeNull();
        pending!.Should().Contain(r => r.RequestId == requestId,
            "pending requests are queried by userId, not by device — timing of device creation should not matter");
    }

    private async Task SeedResolverKeyAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var keyStore = scope.ServiceProvider.GetRequiredService<IKeyStore>();
        var keyEncryptor = scope.ServiceProvider.GetRequiredService<IKeyEncryptor>();
        var (publicKey, privateKey) = TestCryptoHelper.GenerateEcKeyPair();
        await keyStore.CreateKeyAsync(new SigningKey
        {
            KeyId = $"resolver_cli_{Guid.NewGuid():N}",
            Algorithm = "ES256",
            PublicKeyPem = publicKey,
            PrivateKeyPem = keyEncryptor.Encrypt(privateKey),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
    }
}
