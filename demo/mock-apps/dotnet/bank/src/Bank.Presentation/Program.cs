using System.Text.Json.Serialization;
using Bank.Domain;
using Bank.Infrastructure;
using Bank.Services;
using OHPP.Sdk;

var builder = WebApplication.CreateBuilder(args);

// --- JSON serialization: enums as strings ---
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Demo Bank API",
        Version = "v1",
        Description = "OHPP-enabled mock bank application for demonstrating the Open Human Participation Protocol."
    });
});

// --- DI ---
builder.Services.AddSingleton<IAccountStore, InMemoryAccountStore>();
builder.Services.AddSingleton<ITransactionStore, InMemoryTransactionStore>();
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

// Need an IRegistrationStore for the SDK's CallbackHandler
builder.Services.AddSingleton<IRegistrationStore, InMemoryRegistrationStore>();

var app = builder.Build();

// --- Swagger UI ---
app.UseSwagger();
app.UseSwaggerUI();

// --- Static files (HTML UI) ---
app.UseDefaultFiles();
app.UseStaticFiles();

// --- Health ---
app.MapGet("/health", () => Results.Ok(new { status = "healthy", app = "Demo Bank" }));

// --- Account endpoints ---
app.MapGet("/api/accounts", async (AccountService accounts) =>
{
    var all = await accounts.GetAllAccountsAsync();
    return Results.Ok(all);
});

app.MapGet("/api/accounts/{id}", async (string id, AccountService accounts) =>
{
    var account = await accounts.GetAccountAsync(id);
    return account is not null ? Results.Ok(account) : Results.NotFound();
});

// --- Transfer endpoints ---
app.MapPost("/api/transfers", async (TransferRequest request, TransferService transfers) =>
{
    var result = await transfers.InitiateTransferAsync(request);
    return result.Success
        ? Results.Ok(result)
        : Results.BadRequest(result);
});

app.MapGet("/api/transfers/{requestId}/status", async (string requestId, string accountId, TransferService transfers) =>
{
    var result = await transfers.CompleteTransferAsync(accountId, requestId);
    return Results.Ok(result);
});

app.MapGet("/api/transactions", async (string accountId, ITransactionStore transactions, TransferService transfers) =>
{
    var records = await transactions.GetByAccountIdAsync(accountId);

    // Refresh status of any pending transactions (resolves stale state after page reload)
    foreach (var record in records.Where(r => r.Status == TransferStatus.PendingApproval && r.ParticipationRequestId is not null))
    {
        await transfers.CompleteTransferAsync(accountId, record.ParticipationRequestId!);
    }

    // Re-fetch after status updates
    records = await transactions.GetByAccountIdAsync(accountId);
    return Results.Ok(records);
});

// --- Payee endpoints ---
app.MapPost("/api/payees", async (AddPayeeRequest request, AccountService accounts) =>
{
    var success = await accounts.AddPayeeAsync(request);
    return success ? Results.Created() : Results.BadRequest();
});

// --- OHPP Settings ---
app.MapPost("/api/ohpp/register", async (OhppRegistrationRequest request, AccountService accounts) =>
{
    var registration = new OhppRegistration
    {
        ResolverUrl = request.ResolverUrl,
        AccessToken = request.AccessToken,
        UserId = request.UserId
    };
    var success = await accounts.RegisterOhppAsync(request.AccountId, registration);
    return success ? Results.Ok() : Results.BadRequest();
});

app.MapDelete("/api/ohpp/disconnect", async (AccountService accounts) =>
{
    var account = await accounts.GetAccountAsync("demo-account");
    if (account is null) return Results.NotFound();
    account.OhppRegistration = null;
    return Results.Ok(new { status = "disconnected" });
});

app.MapPost("/api/ohpp/generate-challenge", (ChallengeGenerator challengeGen) =>
{
    var challenge = challengeGen.CreateChallenge(TimeSpan.FromMinutes(10));
    var uri = ChallengeGenerator.BuildChallengeUri(challenge);
    return Results.Ok(new { challengeUri = uri, challengeId = challenge.ChallengeId, expiresAt = challenge.ExpiresAt });
});

// --- OHPP Callback (registration ceremony) ---
app.MapPost("/ohpp/callback", async (HttpContext context, CallbackHandler handler, AccountService accounts) =>
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();
    var result = await handler.HandleCallbackAsync(body);
    if (result is null) return Results.BadRequest();

    // Auto-connect OHPP to the demo account when callback arrives
    var registration = new OhppRegistration
    {
        ResolverUrl = resolverInternalUrl ?? result.ResolverBaseUrl,
        AccessToken = result.AccessToken,
        UserId = result.UserId
    };
    await accounts.RegisterOhppAsync("demo-account", registration);

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

// --- Request DTOs ---
public record OhppRegistrationRequest(string AccountId, string ResolverUrl, string AccessToken, string UserId);

// --- In-memory registration store for demo ---
public sealed class InMemoryRegistrationStore : IRegistrationStore
{
    private readonly List<OHPP.Protocol.Models.RegistrationResponse> _registrations = new();

    public Task StoreRegistrationAsync(OHPP.Protocol.Models.RegistrationResponse response, CancellationToken cancellationToken = default)
    {
        _registrations.Add(response);
        return Task.CompletedTask;
    }

    public Task<OHPP.Protocol.Models.RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default)
    {
        var reg = _registrations.FirstOrDefault(r => r.UserId == userId && r.ResolverBaseUrl == resolverBaseUrl);
        return Task.FromResult(reg);
    }

    public Task<IReadOnlyList<OHPP.Protocol.Models.RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<OHPP.Protocol.Models.RegistrationResponse>>(_registrations);
    }
}

public partial class Program { }
