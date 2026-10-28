using Microsoft.EntityFrameworkCore;
using OHPP.Infrastructure.DotNet;
using OHPP.Infrastructure.OpenTelemetry;
using OHPP.Infrastructure.PostgreSQL;
using OHPP.Infrastructure.Protocol.Local;
using OHPP.Infrastructure.Serilog;
using OHPP.Presentation.Api;
using OHPP.Presentation.Api.BackgroundServices;
using OHPP.Presentation.Api.Middleware;
using OHPP.Sdk.Server;
using OHPP.Sdk;
using OHPP.Services.Attestation;
using OHPP.Services.Auth;
using OHPP.Services.Participation;
using OHPP.Services.Registration;

var builder = WebApplication.CreateBuilder(args);

// --- TLS (U7.1, Phase 6) ---
// When a leaf cert (chain PEM) + key are mounted, listen HTTPS on 8443 IN
// ADDITION to the existing HTTP listener (ASPNETCORE_URLS). Dual-listen keeps
// HTTP as a fallback so a cert misconfig cannot brick the stack during the
// incremental HTTPS migration. Env-gated + fail-open: if the cert is missing or
// unreadable, the app still serves HTTP.
{
    var tlsCertPath = Environment.GetEnvironmentVariable("OHPP_TLS_CERT_PATH");
    var tlsKeyPath = Environment.GetEnvironmentVariable("OHPP_TLS_KEY_PATH");
    if (!string.IsNullOrWhiteSpace(tlsCertPath) && !string.IsNullOrWhiteSpace(tlsKeyPath)
        && File.Exists(tlsCertPath) && File.Exists(tlsKeyPath))
    {
        var tlsPort = int.TryParse(Environment.GetEnvironmentVariable("OHPP_TLS_PORT"), out var p) ? p : 8443;
        try
        {
            // The PEM at OHPP_TLS_CERT_PATH is the full chain (leaf + intermediate).
        // Load the leaf+key for the handshake, and the intermediate(s) so Kestrel
        // presents the full chain (clients that trust only the root can then
        // validate). Build the chain collection from the same PEM.
        var cert = System.Security.Cryptography.X509Certificates.X509Certificate2
                .CreateFromPemFile(tlsCertPath, tlsKeyPath);
        var chain = new System.Security.Cryptography.X509Certificates.X509Certificate2Collection();
        chain.ImportFromPemFile(tlsCertPath);
        // Drop the leaf from the chain collection (Kestrel wants only the
        // intermediate(s) in ServerCertificateChain); match by thumbprint.
        var intermediates = new System.Security.Cryptography.X509Certificates.X509Certificate2Collection();
        foreach (var c in chain)
        {
            if (c.Thumbprint != cert.Thumbprint) intermediates.Add(c);
        }
        // Configuring Kestrel endpoints in code overrides ASPNETCORE_URLS, so
        // we must re-declare the HTTP listener explicitly to keep dual-listen.
        var httpPort = int.TryParse(Environment.GetEnvironmentVariable("OHPP_HTTP_PORT"), out var hp) ? hp : 8080;
        builder.WebHost.ConfigureKestrel(kestrel =>
        {
            kestrel.ListenAnyIP(httpPort);                                   // HTTP (fallback)
            kestrel.ListenAnyIP(tlsPort, listen => listen.UseHttps(httpsOptions =>
            {
                httpsOptions.ServerCertificate = cert;
                if (intermediates.Count > 0)
                {
                    httpsOptions.ServerCertificateChain = intermediates;
                }
            }));
        });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[tls] failed to load cert ({ex.Message}); serving HTTP only");
        }
    }
}

// --- Cross-cutting ---
builder.Host.UseOhppSerilog("ohpp.resolver");
builder.Services.AddOhppOpenTelemetry("ohpp.resolver");

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
builder.Services.AddOhppIdentityProvider(builder.Configuration);

// App ID overrides — maps domain-based appIds to internal Docker URLs
var appIdOverrides = builder.Configuration.GetSection("Resolver:AppIdOverrides")
    .GetChildren()
    .ToDictionary(x => x.Key, x => x.Value ?? string.Empty) as IReadOnlyDictionary<string, string>;

builder.Services.AddOhppInfrastructure(
    resolverBaseUrl: builder.Configuration["Resolver:BaseUrl"] ?? "http://localhost:5000",
    encryptionKey: builder.Configuration["Resolver:EncryptionKey"] ?? "",
    appIdOverrides: appIdOverrides,
    maxRegistrationsPerHour: builder.Configuration.GetValue<int?>("Resolver:MaxRegistrationsPerHour") ?? 10);
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
// The Protocol Lab is a self-contained requester app hosted by the Resolver process.
// It registers itself through the real ceremony and uses its own token. Register the
// SDK's HTTP client directly so the Resolver remains net8-compatible.
builder.Services.AddHttpClient("ProtocolLabRequester");
builder.Services.AddSingleton(sp =>
{
    var factory = sp.GetRequiredService<IHttpClientFactory>();
    return new EndpointDiscovery(factory.CreateClient("ProtocolLabRequester"));
});
builder.Services.AddSingleton<IOhppRequesterClient>(sp =>
{
    var factory = sp.GetRequiredService<IHttpClientFactory>();
    return new OhppRequesterClient(factory.CreateClient("ProtocolLabRequester"), sp.GetRequiredService<EndpointDiscovery>());
});

// --- Background Services ---
if (!builder.Configuration.GetValue<bool>("Startup:ContractGeneration"))
{
    builder.Services.AddHostedService<DatabaseInitializationHostedService>();
    builder.Services.AddHostedService<ExpiryEnforcementBackgroundService>();
    builder.Services.AddHostedService<SseHeartbeatService>();
}

var app = builder.Build();

// --- Swagger ---
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "OHPP Resolver API v1");
    options.RoutePrefix = "swagger";
});

// --- Middleware Pipeline ---
app.UseMiddleware<ProtocolLabAvailabilityMiddleware>();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<GlobalExceptionHandler>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<TokenDiscriminationMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();

// --- Routing ---
app.MapControllers();
app.UseOhppResolver(); // Maps protocol endpoints: metadata, JWKS, participate, status, cancel

// Dev/test-only diagnostics: deliberately throw so we can verify that an
// unhandled backend exception surfaces as an OpenTelemetry error span in Grafana
// (U7.1, Phase 4). Gated behind the ProtocolLab feature flag so it is never
// exposed in production. The GlobalExceptionHandler records the exception on the
// active span and returns a clean 500.
if (builder.Configuration.GetValue<bool>("Features:ProtocolLab"))
{
    app.MapGet("/api/diagnostics/throw", () =>
    {
        throw new InvalidOperationException("Deliberate diagnostics error (U7.1 crash-reporting verification).");
    });
}

app.Run();

public partial class Program { }
