using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Bank.Domain;
using Bank.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class BankApiTests : IClassFixture<BankApiFactory>
{
    private readonly BankApiFactory _factory;

    public BankApiTests(BankApiFactory factory) => _factory = factory;

    [Fact]
    public async Task BankApi_UnauthenticatedAccountRequest_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/accounts/demo-account");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task BankApi_AuthenticatedUser_SeesOwnAccountsOnly()
    {
        using var owner = ClientFor("demo-user");
        using var other = ClientFor("other-user");

        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/accounts/demo-account")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync("/api/accounts/demo-account")).StatusCode);
    }

    [Fact]
    public async Task Auth_MissingOhppUserId_IsRejected()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, string.Empty);
        client.DefaultRequestHeaders.Add(TestAuthHandler.AuthenticatedWithoutStableIdHeader, "true");

        var response = await client.GetAsync("/api/accounts");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task BankApi_TransferWithInvalidAmount_ReturnsValidationError()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/transfers", new
        {
            fromAccountId = "demo-account",
            toPayeeId = "payee-landlord",
            amount = 0,
            reference = "invalid"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BankApi_TransferWithValidInput_ReturnsCompletedResult()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/transfers", new
        {
            fromAccountId = "demo-account",
            toPayeeId = "payee-landlord",
            amount = 10,
            reference = "valid"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Completed", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task BankApi_ManualCredentialRegistration_IsNotExposed()
    {
        using var client = ClientFor("demo-user");

        var response = await client.PostAsJsonAsync("/api/ohpp/register", new
        {
            accountId = "demo-account",
            resolverUrl = "https://attacker.example",
            accessToken = "injected-token",
            userId = "demo-user"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task BankApi_RegistrationCallback_PersistsBoundRegistration()
    {
        const string challengeId = "bank-api-callback-challenge";
        _factory.Registrations.AddPending(challengeId, "demo-account", "demo-user");
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/ohpp/callback", new RegistrationResponse
        {
            ChallengeId = challengeId,
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-user",
            AccessToken = "callback-token",
            RegistrationId = "bank-api-registration",
            CreatedAt = DateTimeOffset.UtcNow
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("callback-token", _factory.Registrations.Stored?.AccessToken);
    }

    private HttpClient ClientFor(string userId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, userId);
        return client;
    }
}

public sealed class BankApiFactory : WebApplicationFactory<Program>
{
    public TestBankRegistrationStore Registrations { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("WorldDatabase:RunBootstrap", "false");
        builder.ConfigureTestServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.RemoveAll<IAccountStore>();
            services.RemoveAll<ITransactionStore>();
            services.RemoveAll<IParticipationClient>();
            services.RemoveAll<IBankRegistrationStore>();
            services.RemoveAll<IRegistrationStore>();
            services.AddSingleton<IAccountStore, InMemoryAccountStore>();
            services.AddSingleton<ITransactionStore, InMemoryTransactionStore>();
            services.AddSingleton(Substitute.For<IParticipationClient>());
            services.AddSingleton<IBankRegistrationStore>(Registrations);
            services.AddSingleton<IRegistrationStore>(Registrations);
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                options.DefaultForbidScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        });
    }
}

public sealed class TestBankRegistrationStore : IBankRegistrationStore
{
    private readonly Dictionary<string, PendingBankRegistration> _pending = new();
    public RegistrationResponse? Stored { get; private set; }

    public void AddPending(string challengeId, string accountId, string appUserId) =>
        _pending[challengeId] = new PendingBankRegistration(accountId, appUserId);

    public Task RecordChallengeAsync(string challengeId, string accountId, string appUserId, DateTimeOffset createdAt, CancellationToken cancellationToken = default)
    {
        AddPending(challengeId, accountId, appUserId);
        return Task.CompletedTask;
    }

    public Task StoreRegistrationAsync(RegistrationResponse response, CancellationToken cancellationToken = default)
    {
        if (!_pending.ContainsKey(response.ChallengeId))
            throw new InvalidOperationException("Registration callback does not match a pending challenge.");
        Stored = response;
        return Task.CompletedTask;
    }

    public Task<PendingBankRegistration?> ConsumeChallengeAsync(string challengeId, CancellationToken cancellationToken = default)
    {
        var found = _pending.Remove(challengeId, out var pending);
        return Task.FromResult(found ? pending : null);
    }

    public Task<RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default) =>
        Task.FromResult(Stored is not null && Stored.UserId == userId && Stored.ResolverBaseUrl == resolverBaseUrl ? Stored : null);

    public Task<IReadOnlyList<RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<RegistrationResponse>>(Stored is null ? [] : [Stored]);
}

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string UserHeader = "X-Test-User";
    public const string AuthenticatedWithoutStableIdHeader = "X-Test-Missing-Stable-Id";

#pragma warning disable CS0618
    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock) : base(options, logger, encoder, clock) { }
#pragma warning restore CS0618

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var missingStableId = Request.Headers.ContainsKey(AuthenticatedWithoutStableIdHeader);
        if (!Request.Headers.TryGetValue(UserHeader, out var userId) && !missingStableId)
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "test-subject") };
        if (!missingStableId)
            claims.Add(new Claim("ohpp_user_id", userId.ToString()));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
