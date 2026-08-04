using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using InsuranceClaims.Domain;
using InsuranceClaims.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using Xunit;

namespace InsuranceClaims.Tests.Unit;

public sealed class ClaimsApiTests : IClassFixture<ClaimsApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();
    private readonly ClaimsApiFactory _factory;

    public ClaimsApiTests(ClaimsApiFactory factory) => _factory = factory;

    [Fact]
    public async Task ClaimsApi_UnauthenticatedClaimRequest_IsRejected()
    {
        using var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/claims")).StatusCode);
    }

    [Fact]
    public async Task ClaimsApi_AuthenticatedUser_SeesOwnClaimsOnly()
    {
        _factory.Claims.Seed(Claim("owner-claim", "demo-user"), Claim("other-claim", "other-user"));
        using var client = ClientFor("demo-user");

        var body = await client.GetFromJsonAsync<List<InsuranceClaim>>("/api/claims", JsonOptions);

        Assert.Single(body!);
        Assert.Equal("owner-claim", body![0].Id);
    }

    [Fact]
    public async Task Auth_MissingOhppUserId_IsRejected()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(InsuranceTestAuthHandler.MissingStableIdHeader, "true");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/claims")).StatusCode);
    }

    [Fact]
    public async Task ClaimsApi_InvalidClaim_ReturnsValidationError()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/claims", new
        {
            policyId = "policy-1",
            claimantName = "Demo User",
            incidentDate = "2099-01-01",
            description = "Future incident",
            estimatedAmount = 100
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ClaimsApi_ValidClaim_CreatesOwnedClaim()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/claims", new
        {
            policyId = "policy-1",
            claimantName = "Demo User",
            incidentDate = "2026-07-30",
            description = "Valid claim",
            estimatedAmount = 100
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var claim = await response.Content.ReadFromJsonAsync<InsuranceClaim>(JsonOptions);
        Assert.Equal("demo-user", claim!.UserId);
        Assert.Equal(ClaimStatus.Submitted, claim.Status);
    }

    [Fact]
    public async Task ClaimsApi_SaveDraft_PreservesCompleteClaimEntryWithoutSubmitting()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/claims/drafts", new
        {
            policyId = "policy-1",
            claimantName = "Demo User",
            incidentDate = "2026-07-30",
            incidentAt = "2026-07-30T08:45:00Z",
            description = "Kitchen water damage",
            claimantNote = "Stopcock isolated before the plumber arrived.",
            affectedItems = new[] { "Building", "Contents" },
            estimatedAmount = 1250
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var claim = await response.Content.ReadFromJsonAsync<InsuranceClaim>(JsonOptions);
        Assert.NotNull(claim);
        Assert.Equal(ClaimStatus.Draft, claim.Status);
        Assert.Equal(new DateTimeOffset(2026, 7, 30, 8, 45, 0, TimeSpan.Zero), claim.IncidentAt);
        Assert.Equal("Stopcock isolated before the plumber arrived.", Assert.Single(claim.Notes).Body);
        Assert.Equal(["Building", "Contents"], claim.AffectedItems);
        Assert.Contains((await _factory.Claims.GetAllAsync("demo-user")), saved => saved.Id == claim.Id);
    }

    [Fact]
    public async Task ClaimsApi_RegistrationCallback_PersistsRegistration()
    {
        _factory.Registrations.AllowChallenge("insurance-api-callback-challenge");
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/ohpp/callback", new RegistrationResponse
        {
            ChallengeId = "insurance-api-callback-challenge",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-user",
            AccessToken = "insurance-callback-token",
            RegistrationId = "insurance-api-registration",
            CreatedAt = DateTimeOffset.UtcNow
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("insurance-callback-token", _factory.Registrations.Stored?.AccessToken);
    }

    [Fact]
    public async Task ClaimsApi_Disconnect_RemovesOnlyCurrentUsersRegistration()
    {
        _factory.Registrations.Seed("demo-user");
        using var client = ClientFor("demo-user");

        var response = await client.DeleteAsync("/api/ohpp/disconnect");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(_factory.Registrations.Stored);
    }

    private HttpClient ClientFor(string userId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(InsuranceTestAuthHandler.UserHeader, userId);
        return client;
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }

    private static InsuranceClaim Claim(string id, string userId) => new()
    {
        Id = id,
        UserId = userId,
        PolicyId = "policy-1",
        ClaimNumber = $"CLM-{id}",
        ClaimantName = "Demo User",
        IncidentDate = new DateOnly(2026, 7, 30),
        IncidentAt = new DateTimeOffset(2026, 7, 30, 12, 0, 0, TimeSpan.Zero),
        Description = id,
        EstimatedAmount = 100,
        Status = ClaimStatus.Submitted,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
}

public sealed class ClaimsApiFactory : WebApplicationFactory<Program>
{
    public TestClaimRepository Claims { get; } = new();
    public TestInsuranceRegistrationStore Registrations { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("WorldDatabase:RunBootstrap", "false");
        builder.ConfigureTestServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.RemoveAll<IClaimRepository>();
            services.RemoveAll<IPolicyRepository>();
            services.RemoveAll<IParticipationClient>();
            services.RemoveAll<IClock>();
            services.RemoveAll<IRegistrationStore>();
            services.RemoveAll<IInsuranceRegistrationStore>();
            services.AddSingleton<IClaimRepository>(Claims);
            services.AddSingleton<IPolicyRepository>(new TestPolicyRepository());
            services.AddSingleton<IParticipationClient>(new TestParticipationClient());
            services.AddSingleton<IClock>(new FixedClock());
            services.AddSingleton<IRegistrationStore>(Registrations);
            services.AddSingleton<IInsuranceRegistrationStore>(Registrations);
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = InsuranceTestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = InsuranceTestAuthHandler.SchemeName;
                options.DefaultForbidScheme = InsuranceTestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, InsuranceTestAuthHandler>(InsuranceTestAuthHandler.SchemeName, _ => { });
        });
    }
}

public sealed class TestInsuranceRegistrationStore : IInsuranceRegistrationStore
{
    private readonly HashSet<string> _allowedChallenges = [];
    public RegistrationResponse? Stored { get; private set; }
    public string? StoredAppUserId { get; private set; }

    public void AllowChallenge(string challengeId) => _allowedChallenges.Add(challengeId);
    public void Seed(string appUserId)
    {
        StoredAppUserId = appUserId;
        Stored = new RegistrationResponse
        {
            ChallengeId = "seed-challenge",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-user",
            AccessToken = "seed-token",
            RegistrationId = "seed-registration",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public Task StoreRegistrationAsync(RegistrationResponse response, CancellationToken cancellationToken = default)
    {
        if (!_allowedChallenges.Remove(response.ChallengeId))
            throw new InvalidOperationException("Registration callback does not match a pending challenge.");
        Stored = response;
        return Task.CompletedTask;
    }

    public Task<RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default) =>
        Task.FromResult(Stored is not null && Stored.UserId == userId && Stored.ResolverBaseUrl == resolverBaseUrl ? Stored : null);

    public Task<IReadOnlyList<RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<RegistrationResponse>>(Stored is null ? [] : [Stored]);

    public Task RecordChallengeAsync(string challengeId, string appUserId, DateTimeOffset createdAt, CancellationToken cancellationToken = default)
    {
        _allowedChallenges.Add(challengeId);
        StoredAppUserId = appUserId;
        return Task.CompletedTask;
    }

    public Task<RegistrationResponse?> GetForAppUserAsync(string appUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult(StoredAppUserId == appUserId ? Stored : null);

    public Task<bool> HasRegistrationAsync(string appUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult(StoredAppUserId == appUserId && Stored is not null);

    public Task RevokeForAppUserAsync(string appUserId, CancellationToken cancellationToken = default)
    {
        if (StoredAppUserId == appUserId)
        {
            Stored = null;
            StoredAppUserId = null;
        }
        return Task.CompletedTask;
    }
}

public sealed class TestClaimRepository : IClaimRepository
{
    private readonly Dictionary<string, InsuranceClaim> _claims = new();

    public void Seed(params InsuranceClaim[] claims)
    {
        _claims.Clear();
        foreach (var claim in claims) _claims[claim.Id] = claim;
    }

    public Task<InsuranceClaim?> GetAsync(string id, string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_claims.TryGetValue(id, out var claim) && claim.UserId == userId ? claim : null);

    public Task<IReadOnlyList<InsuranceClaim>> GetAllAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<InsuranceClaim>>(_claims.Values.Where(claim => claim.UserId == userId).ToList());

    public Task SaveAsync(InsuranceClaim claim, CancellationToken cancellationToken = default)
    {
        _claims[claim.Id] = claim;
        return Task.CompletedTask;
    }
}

public sealed class TestPolicyRepository : IPolicyRepository
{
    private static readonly InsurancePolicy Policy = new()
    {
        Id = "policy-1",
        PolicyNumber = "POL-0001",
        CustomerName = "Demo User",
        CoverageLimit = 10_000,
        ValidFrom = new DateOnly(2026, 1, 1),
        ValidTo = new DateOnly(2026, 12, 31),
        Status = PolicyStatus.Active
    };

    public Task<InsurancePolicy?> GetAsync(string id, string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(id == Policy.Id && userId == "demo-user" ? Policy : null);

    public Task<IReadOnlyList<InsurancePolicy>> GetAllAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<InsurancePolicy>>(userId == "demo-user" ? [Policy] : []);
}

public sealed class TestParticipationClient : IParticipationClient
{
    public Task<ParticipationRequestResult> RequestAsync(InsuranceClaim claim, ParticipationScenario scenario, CancellationToken cancellationToken = default) =>
        Task.FromResult(new ParticipationRequestResult(true, "request-1"));

    public Task<ParticipationStatus> GetStatusAsync(string requestId, string userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(new ParticipationStatus(false));
}

public sealed class FixedClock : IClock
{
    public DateTimeOffset UtcNow => new(2026, 7, 31, 0, 0, 0, TimeSpan.Zero);
}

public sealed class InsuranceTestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "InsuranceTest";
    public const string UserHeader = "X-Test-User";
    public const string MissingStableIdHeader = "X-Test-Missing-Stable-Id";

#pragma warning disable CS0618
    public InsuranceTestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock) : base(options, logger, encoder, clock) { }
#pragma warning restore CS0618

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var missingStableId = Request.Headers.ContainsKey(MissingStableIdHeader);
        if (!Request.Headers.TryGetValue(UserHeader, out var userId) && !missingStableId)
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "test-subject") };
        if (!missingStableId) claims.Add(new Claim("ohpp_user_id", userId.ToString()));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
