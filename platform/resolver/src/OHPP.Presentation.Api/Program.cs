using Microsoft.EntityFrameworkCore;
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
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "OHPP Resolver API",
        Version = "v1",
        Description = "Open Human Participation Protocol — Resolver API for portal management, device operations, and app registration."
    });
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT or OHPP token",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your token (Identity JWT for Portal, device token for Device endpoints, app token for Participate endpoints)"
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

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

// --- Auto-migrate database ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OHPP.Infrastructure.PostgreSQL.AppDbContext>();
    db.Database.Migrate();
}

// --- Swagger ---
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "OHPP Resolver API v1");
    options.RoutePrefix = "swagger";
});

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
