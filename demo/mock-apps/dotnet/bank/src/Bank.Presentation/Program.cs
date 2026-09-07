using System.Text.Json.Serialization;
using Bank.Presentation;
using Bank.Domain;
using Bank.Infrastructure;
using Bank.Services;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using Npgsql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

// --- Observability (OpenTelemetry -> OTel Collector; fail-open when unset) ---
builder.AddBankObservability("ohpp.bank");

var authAuthority = builder.Configuration["Auth:Keycloak:Authority"] ?? "http://keycloak:8080/realms/ohpp-bank";
var authAudience = builder.Configuration["Auth:Keycloak:Audience"] ?? "ohpp-bank-app";
// The browser-facing authority is where end users obtain their tokens; the token's
// issuer claim reflects that host. The internal authority (above) may differ during
// the HTTPS migration (e.g. https://keycloak:8443 for the server-to-server metadata
// fetch while the browser still uses http://localhost:8080), so accept both issuers.
var authPublicAuthority = builder.Configuration["Auth:PublicAuthority"] ?? "http://localhost:8080/realms/ohpp-bank";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Fetch OIDC metadata (JWKS) over the internal authority; trust the dev root
        // via SSL_CERT_FILE so the HTTPS metadata call validates.
        options.Authority = authAuthority;
        options.MetadataAddress = $"{authAuthority.TrimEnd('/')}/.well-known/openid-configuration";
        options.Audience = authAudience;
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters.ValidateAudience = true;
        // Accept tokens issued by either the internal or the browser-facing authority.
        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidIssuers = new[] { authAuthority, authPublicAuthority };
    });
builder.Services.AddAuthorization(options =>
    options.AddPolicy("BankUser", policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim("ohpp_user_id")));

// --- JSON serialization: enums as strings ---
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SupportNonNullableReferenceTypes();
    options.NonNullableReferenceTypesAsRequired();
    options.SchemaFilter<StringEnumSchemaFilter>();
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Demo Bank API",
        Version = "v1",
        Description = "OHPP-enabled mock bank application for demonstrating the Open Human Participation Protocol."
    });
});

// --- DI ---
var worldDatabaseConnectionString = builder.Configuration.GetConnectionString("WorldDatabase")
    ?? builder.Configuration["WorldDatabase:ConnectionString"]
    ?? "Host=postgres;Port=5432;Database=ohpp;Username=ohpp;Password=ohpp";
builder.Services.AddSingleton(new NpgsqlDataSourceBuilder(worldDatabaseConnectionString).Build());
builder.Services.AddSingleton<WorldDatabaseInitializer>();
builder.Services.AddSingleton<IAccountStore, PostgresAccountStore>();
builder.Services.AddSingleton<ITransactionStore, PostgresTransactionStore>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<TransferService>();

// OHPP SDK (Requester)
var appId = builder.Configuration["Bank:AppId"] ?? "bank.demo.test";
var bankBaseUrl = builder.Configuration["Bank:BaseUrl"] ?? "http://localhost:5010";
var resolverInternalUrl = builder.Configuration["Bank:ResolverInternalUrl"];

builder.Services.AddOhppRequester(options =>
{
    options.AppId = appId;
    options.AppName = "Demo Bank";
    options.CallbackPath = "/ohpp/callback";
    options.BaseUrl = bankBaseUrl;
});

builder.Services.AddScoped<IParticipationClient>(sp =>
{
    var requesterClient = sp.GetRequiredService<IOhppRequesterClient>();
    return new OhppParticipationClient(requesterClient, appId);
});
builder.Services.AddScoped(sp => new BankProtocolScenarioClient(
    sp.GetRequiredService<IOhppRequesterClient>(),
    appId));

// The concrete store binds registration challenges to the originating app user.
builder.Services.AddSingleton<PostgresRegistrationStore>();
builder.Services.AddSingleton<IBankRegistrationStore>(serviceProvider =>
    serviceProvider.GetRequiredService<PostgresRegistrationStore>());
builder.Services.AddSingleton<IRegistrationStore>(serviceProvider =>
    serviceProvider.GetRequiredService<IBankRegistrationStore>());

var app = builder.Build();

if (!string.Equals(builder.Configuration["WorldDatabase:RunBootstrap"], "false", StringComparison.OrdinalIgnoreCase))
    await app.Services.GetRequiredService<WorldDatabaseInitializer>().InitializeAsync();

// --- Swagger UI ---
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();

// --- Static files (HTML UI) ---
app.UseDefaultFiles();
app.UseStaticFiles();

// --- Health ---
app.MapGet("/health", () => Results.Ok(new { status = "healthy", app = "Demo Bank" }));
app.MapGet("/.well-known/ohpp/auth-config", () => Results.Ok(new BankAuthConfigResponse(
    builder.Configuration["Auth:PublicAuthority"] ?? "http://localhost:8080/realms/ohpp-bank",
    "ohpp-bank-app")))
    .Produces<BankAuthConfigResponse>();

// --- Account endpoints ---
app.MapGet("/api/accounts", async (ClaimsPrincipal principal, AccountService accounts) =>
{
    var all = await accounts.GetAllAccountsAsync();
    return Results.Ok(all.Where(account => account.OwnerUserId == RequireUserId(principal)));
}).RequireAuthorization("BankUser")
    .Produces<IReadOnlyList<Account>>();

app.MapGet("/api/accounts/{id}", async (string id, ClaimsPrincipal principal, AccountService accounts) =>
{
    var account = await accounts.GetAccountAsync(id);
    return account is not null && account.OwnerUserId == RequireUserId(principal)
        ? Results.Ok(account)
        : Results.NotFound();
}).RequireAuthorization("BankUser")
    .Produces<Account>()
    .Produces(StatusCodes.Status404NotFound);

// --- Transfer endpoints ---
app.MapPost("/api/transfers", async (TransferRequest request, ClaimsPrincipal principal, AccountService accounts, TransferService transfers) =>
{
    if (!await OwnsAccountAsync(request.FromAccountId, principal, accounts))
        return Results.NotFound();
    var result = await transfers.InitiateTransferAsync(request);
    return result.Success
        ? Results.Ok(result)
        : Results.BadRequest(result);
}).RequireAuthorization("BankUser")
    .Produces<TransferResult>()
    .Produces<TransferResult>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

app.MapGet("/api/transfers/{requestId}/status", async (string requestId, string accountId, ClaimsPrincipal principal, AccountService accounts, TransferService transfers) =>
{
    if (!await OwnsAccountAsync(accountId, principal, accounts))
        return Results.NotFound();
    var result = await transfers.CompleteTransferAsync(accountId, requestId);
    return Results.Ok(result);
}).RequireAuthorization("BankUser")
    .Produces<TransferResult>()
    .Produces(StatusCodes.Status404NotFound);

app.MapGet("/api/transactions", async (string accountId, ClaimsPrincipal principal, AccountService accounts, ITransactionStore transactions, TransferService transfers, IClock clock) =>
{
    if (!await OwnsAccountAsync(accountId, principal, accounts))
        return Results.NotFound();
    await transactions.ExecuteDueScheduledAsync(accountId, clock.UtcNow);
    var records = await transactions.GetByAccountIdAsync(accountId);

    // Refresh status of any pending transactions (resolves stale state after page reload)
    foreach (var record in records.Where(r => r.Status == TransferStatus.PendingApproval && r.ParticipationRequestId is not null))
    {
        await transfers.CompleteTransferAsync(accountId, record.ParticipationRequestId!);
    }

    // Re-fetch after status updates
    records = await transactions.GetByAccountIdAsync(accountId);
    return Results.Ok(records);
}).RequireAuthorization("BankUser")
    .Produces<IReadOnlyList<TransactionRecord>>()
    .Produces(StatusCodes.Status404NotFound);

// --- Payee endpoints ---
app.MapPost("/api/payees", async (AddPayeeRequest request, ClaimsPrincipal principal, AccountService accounts) =>
{
    if (!await OwnsAccountAsync(request.AccountId, principal, accounts))
        return Results.NotFound();
    var success = await accounts.AddPayeeAsync(request);
    return success ? Results.Created() : Results.BadRequest();
}).RequireAuthorization("BankUser")
    .Produces(StatusCodes.Status201Created)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

app.MapDelete("/api/ohpp/disconnect", async (string accountId, ClaimsPrincipal principal, AccountService accounts) =>
{
    var account = await accounts.GetAccountAsync(accountId);
    if (account is null || account.OwnerUserId != RequireUserId(principal)) return Results.NotFound();
    account.OhppRegistration = null;
    await accounts.SaveAccountAsync(account);
    return Results.Ok(new { status = "disconnected" });
}).RequireAuthorization("BankUser")
    .Produces(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status404NotFound);

app.MapPost("/api/ohpp/scenarios/{scenario}", async (
    BankProtocolScenario scenario,
    BankScenarioRequest request,
    ClaimsPrincipal principal,
    AccountService accounts,
    BankProtocolScenarioClient scenarios,
    CancellationToken cancellationToken) =>
{
    var account = await accounts.GetAccountAsync(request.AccountId);
    if (account is null || account.OwnerUserId != RequireUserId(principal))
        return Results.NotFound();
    if (account.OhppRegistration is null)
        return Results.BadRequest(new BankProtocolScenarioResult(false, Error: "Connect OHPP before creating a scenario."));
    var result = await scenarios.CreateAsync(account.OhppRegistration, scenario, cancellationToken);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
}).RequireAuthorization("BankUser")
    .Produces<BankProtocolScenarioResult>()
    .Produces<BankProtocolScenarioResult>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

app.MapGet("/api/ohpp/scenarios/{requestId}/status", async (
    string requestId,
    string accountId,
    ClaimsPrincipal principal,
    AccountService accounts,
    BankProtocolScenarioClient scenarios,
    CancellationToken cancellationToken) =>
{
    var account = await accounts.GetAccountAsync(accountId);
    if (account is null || account.OwnerUserId != RequireUserId(principal))
        return Results.NotFound();
    if (account.OhppRegistration is null)
        return Results.BadRequest();
    return Results.Ok(await scenarios.GetStatusAsync(account.OhppRegistration, requestId, cancellationToken));
}).RequireAuthorization("BankUser")
    .Produces<BankProtocolScenarioStatus>()
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

app.MapPost("/api/ohpp/generate-challenge", async (
    GenerateBankChallengeRequest request,
    ChallengeGenerator challengeGen,
    ClaimsPrincipal principal,
    AccountService accounts,
    IBankRegistrationStore registrations,
    IClock clock,
    CancellationToken cancellationToken) =>
{
    var appUserId = RequireUserId(principal);
    if (!await OwnsAccountAsync(request.AccountId, principal, accounts))
        return Results.NotFound();
    var challenge = challengeGen.CreateChallenge(TimeSpan.FromMinutes(10));
    await registrations.RecordChallengeAsync(
        challenge.ChallengeId,
        request.AccountId,
        appUserId,
        clock.UtcNow,
        cancellationToken);
    var uri = ChallengeGenerator.BuildChallengeUri(challenge);
    return Results.Ok(new BankChallengeResponse(uri, challenge.ChallengeId, challenge.ExpiresAt));
}).RequireAuthorization("BankUser")
    .Produces<BankChallengeResponse>()
    .Produces(StatusCodes.Status404NotFound);

// --- OHPP Callback (registration ceremony) ---
app.MapPost("/ohpp/callback", async (
    HttpContext context,
    CallbackHandler handler,
    AccountService accounts,
    IBankRegistrationStore registrations) =>
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();
    RegistrationResponse? result;
    try
    {
        result = await handler.HandleCallbackAsync(body);
    }
    catch (InvalidOperationException)
    {
        return Results.BadRequest();
    }
    if (result is null) return Results.BadRequest();

    var target = await registrations.ConsumeChallengeAsync(result.ChallengeId);
    if (target is null)
        return Results.BadRequest();
    var account = await accounts.GetAccountAsync(target.AccountId);
    if (account is null || account.OwnerUserId != target.AppUserId)
        return Results.BadRequest();

    var registration = new OhppRegistration
    {
        ResolverUrl = resolverInternalUrl ?? result.ResolverBaseUrl,
        AccessToken = result.AccessToken,
        UserId = result.UserId
    };
    await accounts.RegisterOhppAsync(target.AccountId, registration);

    return Results.Ok();
});

// --- App Metadata (required by protocol) ---
app.MapGet("/.well-known/ohpp/app-metadata", () => Results.Ok(new
{
    appId,
    name = "Demo Bank",
    icon = (string?)null,
    version = "1.0",
    endpoints = new { registrationCallback = "/ohpp/callback" }
}));

app.Run();

static string RequireUserId(ClaimsPrincipal principal) =>
    principal.FindFirstValue("ohpp_user_id")
    ?? throw new UnauthorizedAccessException("The access token has no ohpp_user_id claim.");

static async Task<bool> OwnsAccountAsync(string accountId, ClaimsPrincipal principal, AccountService accounts)
{
    var account = await accounts.GetAccountAsync(accountId);
    return account is not null && account.OwnerUserId == RequireUserId(principal);
}

// --- Request DTOs ---
public sealed record GenerateBankChallengeRequest(string AccountId);

public sealed record BankScenarioRequest(string AccountId);

public sealed record BankChallengeResponse(string ChallengeUri, string ChallengeId, DateTimeOffset ExpiresAt);

public sealed record BankAuthConfigResponse(string Authority, string ClientId);

public sealed class StringEnumSchemaFilter : Swashbuckle.AspNetCore.SwaggerGen.ISchemaFilter
{
    public void Apply(OpenApiSchema schema, Swashbuckle.AspNetCore.SwaggerGen.SchemaFilterContext context)
    {
        if (!context.Type.IsEnum)
            return;

        schema.Type = "string";
        schema.Format = null;
        schema.Enum.Clear();
        foreach (var name in Enum.GetNames(context.Type))
            schema.Enum.Add(new OpenApiString(name));
    }
}

public partial class Program { }
