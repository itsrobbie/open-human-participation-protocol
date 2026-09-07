using System.Security.Claims;
using System.Text.Json.Serialization;
using InsuranceClaims.Domain;
using InsuranceClaims.Infrastructure;
using InsuranceClaims.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Npgsql;
using OHPP.Sdk;
using InsuranceClaims.Presentation;

var builder = WebApplication.CreateBuilder(args);

// --- Observability (OpenTelemetry -> OTel Collector; fail-open when unset) ---
builder.AddInsuranceObservability("ohpp.insurance");

var authority = builder.Configuration["Auth:Keycloak:Authority"]
    ?? "http://keycloak:8080/realms/ohpp-insurance";
var audience = builder.Configuration["Auth:Keycloak:Audience"]
    ?? "ohpp-insurance-app";
// Browser-facing authority: the token's issuer claim reflects the host the end user
// logged in through. It may differ from the internal metadata authority during the
// HTTPS migration (internal https://keycloak:8443 vs browser http://localhost:8080),
// so accept both issuers.
var publicAuthority = builder.Configuration["Auth:PublicAuthority"]
    ?? "http://localhost:8080/realms/ohpp-insurance";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.MetadataAddress = $"{authority.TrimEnd('/')}/.well-known/openid-configuration";
        options.Audience = audience;
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidIssuers = new[] { authority, publicAuthority };
    });
builder.Services.AddAuthorization(options =>
    options.AddPolicy("AppUser", policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim("ohpp_user_id")));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SupportNonNullableReferenceTypes();
    options.NonNullableReferenceTypesAsRequired();
    options.SchemaFilter<StringEnumSchemaFilter>();
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Demo Insurance Claims API",
        Version = "v1",
        Description = "Authenticated claim and OHPP participation endpoints for the Insurance Claims mock app."
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Access token issued by the ohpp-insurance Keycloak realm."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        }] = Array.Empty<string>()
    });
});

var connectionString = builder.Configuration["WorldDatabase:ConnectionString"]
    ?? "Host=postgres;Port=5432;Database=ohpp;Username=ohpp;Password=ohpp";
builder.Services.AddSingleton(new NpgsqlDataSourceBuilder(connectionString).Build());
builder.Services.AddSingleton<ClaimsDatabaseInitializer>();
builder.Services.AddSingleton<IClaimRepository, PostgresClaimRepository>();
builder.Services.AddSingleton<IPolicyRepository, PostgresPolicyRepository>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<PostgresInsuranceRegistrationStore>();
builder.Services.AddSingleton<IInsuranceRegistrationStore>(serviceProvider =>
    serviceProvider.GetRequiredService<PostgresInsuranceRegistrationStore>());
builder.Services.AddSingleton<IRegistrationStore>(serviceProvider =>
    serviceProvider.GetRequiredService<IInsuranceRegistrationStore>());
builder.Services.AddOhppRequester(options =>
{
    options.AppId = builder.Configuration["Insurance:AppId"] ?? "insurance-claims.demo.test";
    options.AppName = "Demo Insurance Claims";
    options.BaseUrl = builder.Configuration["Insurance:BaseUrl"] ?? "http://localhost:5020";
    options.CallbackPath = "/ohpp/callback";
});
builder.Services.AddScoped<IParticipationClient>(serviceProvider => new OhppClaimsParticipationClient(
    serviceProvider.GetRequiredService<IOhppRequesterClient>(),
    serviceProvider.GetRequiredService<IInsuranceRegistrationStore>(),
    builder.Configuration["Insurance:ResolverUrl"] ?? "http://resolver:8080",
    builder.Configuration["Insurance:ResolverAccessToken"] ?? string.Empty,
    builder.Configuration["Insurance:AppId"] ?? "insurance-claims.demo.test"));
builder.Services.AddScoped<IClaimService, ClaimService>();

var app = builder.Build();
if (!string.Equals(builder.Configuration["WorldDatabase:RunBootstrap"], "false", StringComparison.OrdinalIgnoreCase))
    await app.Services.GetRequiredService<ClaimsDatabaseInitializer>().InitializeAsync();

app.UseSwagger();
app.UseSwaggerUI();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", app = "Demo Insurance Claims" }))
    .WithSummary("Get application health")
    .WithDescription("Returns the shallow health state used by Docker Compose.");

app.MapGet("/.well-known/ohpp/app-metadata", () => Results.Ok(new
{
    appId = builder.Configuration["Insurance:AppId"] ?? "insurance-claims.demo.test",
    name = "Demo Insurance Claims",
    version = "1.0",
    endpoints = new { registrationCallback = "/ohpp/callback" }
}))
    .WithSummary("Get OHPP requester metadata")
    .WithDescription("Describes the Insurance Claims requester and its registration callback.");

app.MapPost("/ohpp/callback", async (HttpRequest request, CallbackHandler handler) =>
{
    using var reader = new StreamReader(request.Body);
    try
    {
        var result = await handler.HandleCallbackAsync(await reader.ReadToEndAsync());
        return result is null ? Results.BadRequest() : Results.Ok();
    }
    catch (InvalidOperationException)
    {
        return Results.BadRequest();
    }
})
    .WithSummary("Receive an OHPP registration callback")
    .WithDescription("Validates and stores Resolver credentials delivered by the registration ceremony.");

var api = app.MapGroup("/api").RequireAuthorization("AppUser");

api.MapGet("/policies", async (ClaimsPrincipal principal, IPolicyRepository policies, CancellationToken cancellationToken) =>
{
    var userId = RequireUserId(principal);
    return Results.Ok(await policies.GetAllAsync(userId, cancellationToken));
})
    .WithSummary("List policies for the signed-in user")
    .WithDescription("Returns only policies owned by the stable ohpp_user_id in the access token.")
    .Produces<IReadOnlyList<InsurancePolicy>>();

api.MapGet("/claims", async (ClaimsPrincipal principal, IClaimRepository claims, CancellationToken cancellationToken) =>
{
    var userId = RequireUserId(principal);
    return Results.Ok(await claims.GetAllAsync(userId, cancellationToken));
})
    .WithSummary("List claims for the signed-in user")
    .WithDescription("Returns only claims owned by the stable ohpp_user_id in the access token.")
    .Produces<IReadOnlyList<InsuranceClaim>>();

api.MapPost("/claims", async (
    CreateClaimRequest request,
    ClaimsPrincipal principal,
    IClaimService service,
    IClock clock,
    CancellationToken cancellationToken) =>
{
    var claim = CreateClaim(request, RequireUserId(principal), clock.UtcNow);
    var result = await service.SubmitAsync(claim, cancellationToken);
    return result.IsSuccess ? Results.Ok(claim) : Results.BadRequest(result);
})
    .WithSummary("Submit a claim")
    .WithDescription("Validates a new claim, assigns ownership from the access token, and stores it.")
    .Produces<InsuranceClaim>()
    .Produces<ClaimOperationResult>(StatusCodes.Status400BadRequest);

api.MapPost("/claims/drafts", async (
    CreateClaimRequest request,
    ClaimsPrincipal principal,
    IClaimService service,
    IClock clock,
    CancellationToken cancellationToken) =>
{
    var claim = CreateClaim(request, RequireUserId(principal), clock.UtcNow);
    var result = await service.SaveDraftAsync(claim, cancellationToken);
    return result.IsSuccess ? Results.Ok(claim) : Results.BadRequest(result);
})
    .WithSummary("Save a claim draft")
    .WithDescription("Stores the complete claim-entry state without advancing it to submitted.")
    .Produces<InsuranceClaim>()
    .Produces<ClaimOperationResult>(StatusCodes.Status400BadRequest);

api.MapPost("/claims/{id}/submit", async (
    string id,
    ClaimsPrincipal principal,
    IClaimRepository claims,
    IClaimService service,
    CancellationToken cancellationToken) =>
{
    var claim = await claims.GetAsync(id, RequireUserId(principal), cancellationToken);
    if (claim is null)
        return Results.NotFound();
    var result = await service.SubmitAsync(claim, cancellationToken);
    return result.IsSuccess ? Results.Ok(claim) : Results.BadRequest(result);
})
    .WithSummary("Submit a saved claim draft")
    .WithDescription("Validates an owned draft and advances it to submitted.")
    .Produces<InsuranceClaim>()
    .Produces<ClaimOperationResult>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

api.MapPost("/claims/{id}/participation", async (
    string id,
    ClaimScenario scenario,
    ClaimsPrincipal principal,
    IClaimRepository claims,
    IClaimService service,
    CancellationToken cancellationToken) =>
{
    var claim = await claims.GetAsync(id, RequireUserId(principal), cancellationToken);
    if (claim is null)
        return Results.NotFound();
    var result = await service.CreateParticipationAsync(claim, scenario, cancellationToken);
    return result.IsSuccess ? Results.Ok(result) : Results.BadRequest(result);
})
    .WithSummary("Request human participation for a claim")
    .WithDescription("Creates one of the seven app-defined OHPP request scenarios for an owned claim.")
    .Produces<ClaimOperationResult>()
    .Produces<ClaimOperationResult>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

api.MapGet("/claims/{id}/participation/status", async (
    string id,
    ClaimsPrincipal principal,
    IClaimRepository claims,
    IClaimService service,
    CancellationToken cancellationToken) =>
{
    var claim = await claims.GetAsync(id, RequireUserId(principal), cancellationToken);
    if (claim is null)
        return Results.NotFound();
    var result = await service.RefreshParticipationAsync(claim, cancellationToken);
    return result.IsSuccess ? Results.Ok(claim) : Results.BadRequest(result);
})
    .WithSummary("Refresh claim participation status")
    .WithDescription("Reads the Resolver status through the requester SDK and applies the answer to the claim.")
    .Produces<InsuranceClaim>()
    .Produces<ClaimOperationResult>(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status404NotFound);

api.MapPost("/ohpp/generate-challenge", async (
    ChallengeGenerator challengeGenerator,
    ClaimsPrincipal principal,
    IInsuranceRegistrationStore registrations,
    IClock clock,
    CancellationToken cancellationToken) =>
{
    var userId = RequireUserId(principal);
    // Guard against re-connecting an already-connected app: each challenge that
    // completes would otherwise drive another registration ceremony. Short-
    // circuit so a connected user cannot spawn redundant registrations.
    if (await registrations.HasRegistrationAsync(userId, cancellationToken))
        return Results.Conflict(new { error = "Already connected to OHPP", connected = true });

    var challenge = challengeGenerator.CreateChallenge(TimeSpan.FromMinutes(10));
    await registrations.RecordChallengeAsync(challenge.ChallengeId, userId, clock.UtcNow, cancellationToken);
    return Results.Ok(new RegistrationChallengeResponse(
        ChallengeGenerator.BuildChallengeUri(challenge),
        challenge.ChallengeId,
        challenge.ExpiresAt));
})
    .WithSummary("Generate an OHPP registration challenge")
    .WithDescription("Creates the URI that the signed-in user submits to their Resolver.")
    .Produces<RegistrationChallengeResponse>();

api.MapGet("/ohpp/status", async (
    ClaimsPrincipal principal,
    IInsuranceRegistrationStore registrations,
    CancellationToken cancellationToken) =>
{
    var userId = RequireUserId(principal);
    return Results.Ok(new ConnectionStatusResponse(
        await registrations.HasRegistrationAsync(userId, cancellationToken)));
})
    .WithSummary("Get OHPP connection status")
    .WithDescription("Reports whether the signed-in user has stored Resolver credentials.")
    .Produces<ConnectionStatusResponse>();

api.MapDelete("/ohpp/disconnect", async (
    ClaimsPrincipal principal,
    IInsuranceRegistrationStore registrations,
    CancellationToken cancellationToken) =>
{
    await registrations.RevokeForAppUserAsync(RequireUserId(principal), cancellationToken);
    return Results.Ok(new ConnectionStatusResponse(false));
})
    .WithSummary("Disconnect OHPP registration")
    .WithDescription("Revokes the signed-in user's locally stored Resolver credentials.")
    .Produces<ConnectionStatusResponse>();

app.MapGet("/.well-known/ohpp/auth-config", () => Results.Ok(new AuthConfigResponse(
    builder.Configuration["Auth:PublicAuthority"]
        ?? "http://localhost:8080/realms/ohpp-insurance",
    audience)))
    .WithSummary("Get browser authentication configuration")
    .WithDescription("Returns the public Keycloak authority and client ID used by the demo login form.")
    .Produces<AuthConfigResponse>();

app.MapFallbackToFile("index.html");
app.Run();

static string RequireUserId(ClaimsPrincipal principal) =>
    principal.FindFirstValue("ohpp_user_id")
    ?? throw new UnauthorizedAccessException("The access token has no ohpp_user_id claim.");

static InsuranceClaim CreateClaim(CreateClaimRequest request, string userId, DateTimeOffset now) => new()
{
    Id = Guid.NewGuid().ToString(),
    UserId = userId,
    PolicyId = request.PolicyId,
    ClaimNumber = $"CLM-{now:yyyyMMddHHmmssfff}-{Guid.NewGuid().ToString("N")[..6]}",
    ClaimantName = request.ClaimantName,
    IncidentDate = request.IncidentDate,
    IncidentAt = request.IncidentAt ?? request.IncidentDate.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc),
    Description = request.Description,
    Notes = string.IsNullOrWhiteSpace(request.ClaimantNote) ? [] :
    [
        new ClaimNote
        {
            Id = Guid.NewGuid().ToString(),
            AuthorType = "claimant",
            Body = request.ClaimantNote.Trim(),
            CreatedAt = now
        }
    ],
    AffectedItems = request.AffectedItems ?? [],
    EstimatedAmount = request.EstimatedAmount,
    Status = ClaimStatus.Draft,
    CreatedAt = now,
    UpdatedAt = now
};

public sealed record CreateClaimRequest(
    string PolicyId,
    string ClaimantName,
    DateOnly IncidentDate,
    string Description,
    decimal EstimatedAmount,
    DateTimeOffset? IncidentAt = null,
    string? ClaimantNote = null,
    IReadOnlyList<string>? AffectedItems = null);

public sealed record RegistrationChallengeResponse(
    string ChallengeUri,
    string ChallengeId,
    DateTimeOffset ExpiresAt);

public sealed record ConnectionStatusResponse(bool Connected);

public sealed record AuthConfigResponse(string Authority, string ClientId);

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

public partial class Program;
