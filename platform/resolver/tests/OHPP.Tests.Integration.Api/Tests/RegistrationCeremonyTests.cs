using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Registration;
using OHPP.Tests.Integration.Api.Infrastructure;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class RegistrationCeremonyTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly WireMockServer _wireMock;
    private HttpClient _client = null!;
    private Guid _userId;

    public RegistrationCeremonyTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _wireMock = WireMockServer.Start();
    }

    public async Task InitializeAsync()
    {
        // Register WireMock URLs for test appIds
        _factory.AppIdOverrides["bank.test"] = _wireMock.Url!;
        _factory.AppIdOverrides["fail.test"] = _wireMock.Url!;
        _factory.AppIdOverrides["duplicate.test"] = _wireMock.Url!;

        // Create an authenticated user
        var externalId = Guid.NewGuid().ToString("N");
        var email = $"{externalId}@test.ohpp.dev";
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(
            $"{{\"sub\":\"{externalId}\",\"email\":\"{email}\"}}"));
        var token = $"eyJhbGciOiJ0ZXN0In0.{payload}.test_sig_{externalId}";

        _factory.FakeIdentityValidator.RegisterToken(token, new Domain.Auth.IdentityTokenClaims
        {
            ExternalId = externalId,
            Email = email,
            DisplayName = "Test User"
        });

        _client = _factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Trigger user creation
        await _client.PostAsync("/api/users/me", null);

        using var scope = _factory.Services.CreateScope();
        var userRepo = scope.ServiceProvider.GetRequiredService<Domain.Auth.IUserRepository>();
        var user = await userRepo.GetByExternalIdAsync(externalId);
        _userId = user!.Id;
    }

    public Task DisposeAsync()
    {
        _wireMock.Stop();
        return Task.CompletedTask;
    }

    private string BuildChallengePayload(string appId, DateTimeOffset? expiresAt = null)
    {
        var challenge = new
        {
            challengeId = Guid.NewGuid().ToString(),
            requesterAppId = appId,
            expiresAt = (expiresAt ?? DateTimeOffset.UtcNow.AddMinutes(5)).ToString("o"),
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        var json = JsonSerializer.Serialize(challenge);
        var bytes = Encoding.UTF8.GetBytes(json);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    [Fact]
    public async Task Registration_FullCeremony_HappyPath()
    {
        // Setup WireMock: metadata endpoint
        _wireMock.Given(Request.Create().WithPath("/.well-known/ohpp/app-metadata").UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(new
                {
                    appId = "bank.test",
                    name = "Test Bank",
                    icon = "https://bank.test/icon.png",
                    endpoints = new { registrationCallback = "/ohpp/callback" },
                    version = "1.0"
                })));

        // Setup WireMock: callback endpoint
        _wireMock.Given(Request.Create().WithPath("/ohpp/callback").UsingPost())
            .RespondWith(Response.Create().WithStatusCode(200));

        var challengePayload = BuildChallengePayload("bank.test");

        var response = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload });

        var body = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.OK, because: body);
        body.Should().Contain("bank.test");
        body.Should().Contain("Test Bank");
    }

    [Fact]
    public async Task Registration_ExpiredChallenge_RejectedAtResolver()
    {
        var challengePayload = BuildChallengePayload("bank.test", expiresAt: DateTimeOffset.UtcNow.AddMinutes(-1));

        var response = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("expired");
    }

    [Fact]
    public async Task Registration_MetadataFetchFails_RegistrationAborted()
    {
        // WireMock returns 404 for metadata
        _wireMock.Given(Request.Create().WithPath("/.well-known/ohpp/app-metadata").UsingGet())
            .RespondWith(Response.Create().WithStatusCode(404));

        var challengePayload = BuildChallengePayload("fail.test");

        var response = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Registration_DuplicateApp_OldRevoked()
    {
        // Setup WireMock for duplicate.test
        _wireMock.Given(Request.Create().WithPath("/.well-known/ohpp/app-metadata").UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(new
                {
                    appId = "duplicate.test",
                    name = "Duplicate App",
                    endpoints = new { registrationCallback = "/ohpp/callback" },
                    version = "1.0"
                })));

        _wireMock.Given(Request.Create().WithPath("/ohpp/callback").UsingPost())
            .RespondWith(Response.Create().WithStatusCode(200));

        // First registration
        var challenge1 = BuildChallengePayload("duplicate.test");
        var response1 = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload = challenge1 });
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Second registration — should revoke old
        var challenge2 = BuildChallengePayload("duplicate.test");
        var response2 = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload = challenge2 });
        response2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify old is revoked — user should see two registrations, one revoked
        using var scope = _factory.Services.CreateScope();
        var appRepo = scope.ServiceProvider.GetRequiredService<IAppRegistrationRepository>();
        var apps = await appRepo.GetByUserIdAsync(_userId);
        var duplicateApps = apps.Where(a => a.AppId == "duplicate.test").ToList();
        duplicateApps.Should().HaveCount(2);
        duplicateApps.Count(a => a.RevokedAt.HasValue).Should().Be(1);
        duplicateApps.Count(a => !a.RevokedAt.HasValue).Should().Be(1);
    }

    [Fact]
    public async Task Registration_InvalidAppIdFormat_Rejected()
    {
        // Challenge with invalid appId (no dot — not a domain)
        var challenge = new
        {
            challengeId = Guid.NewGuid().ToString(),
            requesterAppId = "invalid-no-dot",
            expiresAt = DateTimeOffset.UtcNow.AddMinutes(5).ToString("o"),
            createdAt = DateTimeOffset.UtcNow.ToString("o")
        };
        var json = JsonSerializer.Serialize(challenge);
        var bytes = Encoding.UTF8.GetBytes(json);
        var challengePayload = Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var response = await _client.PostAsJsonAsync("/api/registrations/process-challenge",
            new { challengePayload });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("domain");
    }
}
