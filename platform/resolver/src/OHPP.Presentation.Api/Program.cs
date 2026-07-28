using OHPP.Infrastructure.DotNet;
using OHPP.Infrastructure.Firebase;
using OHPP.Infrastructure.OpenTelemetry;
using OHPP.Infrastructure.PostgreSQL;
using OHPP.Infrastructure.Protocol.Local;
using OHPP.Infrastructure.Serilog;
using OHPP.Presentation.Api;
using OHPP.Presentation.Api.BackgroundServices;
using OHPP.Presentation.Api.Middleware;
using OHPP.Sdk.Server;
using OHPP.Services.Attestation;
using OHPP.Services.Auth;
using OHPP.Services.Participation;
using OHPP.Services.Registration;

var builder = WebApplication.CreateBuilder(args);

// --- Cross-cutting ---
builder.Host.UseOhppSerilog();
builder.Services.AddOhppOpenTelemetry();

// --- Controllers ---
builder.Services.AddControllers();

// --- Infrastructure ---
builder.Services.AddOhppPostgreSQL(builder.Configuration.GetConnectionString("PostgreSQL")!);
builder.Services.AddOhppFirebaseAuth();
builder.Services.AddOhppInfrastructure(
    resolverBaseUrl: builder.Configuration["Resolver:BaseUrl"] ?? "http://localhost:5000",
    encryptionKey: builder.Configuration["Resolver:EncryptionKey"] ?? "");
builder.Services.AddOhppProtocolValidation();

// --- Services ---
builder.Services.AddOhppAuthServices();
builder.Services.AddOhppRegistrationServices();
builder.Services.AddOhppParticipationServices();
builder.Services.AddOhppAttestationServices();

// --- SDK Server (protocol endpoints) ---
builder.Services.AddOhppResolver<OhppResolverServicesAdapter, OhppAuthContextAccessor>(options =>
{
    options.BaseUrl = builder.Configuration["Resolver:BaseUrl"] ?? "http://localhost:5000";
    options.Name = builder.Configuration["Resolver:Name"] ?? "OHPP Resolver";
});

// --- Background Services ---
builder.Services.AddHostedService<ExpiryEnforcementBackgroundService>();
builder.Services.AddHostedService<SseHeartbeatService>();

var app = builder.Build();

// --- Middleware Pipeline ---
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<GlobalExceptionHandler>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<TokenDiscriminationMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();

// --- Routing ---
app.MapControllers();
app.UseOhppResolver(); // Maps protocol endpoints: metadata, JWKS, participate, status, cancel

app.Run();

public partial class Program { }
