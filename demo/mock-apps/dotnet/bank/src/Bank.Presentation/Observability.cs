using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Bank.Presentation;

/// <summary>
/// Self-contained OpenTelemetry wiring for the Demo Bank (U7.1).
///
/// This mock app models an independent third-party company integrating with
/// OHPP, so its observability is deliberately self-contained: it depends only
/// on the standard OpenTelemetry NuGet packages, exactly as a real integrator
/// would. No shared OHPP infra project is referenced.
///
/// Config-driven and fail-open: telemetry is exported only when
/// OTEL_EXPORTER_OTLP_ENDPOINT is set (the OTel Collector in dev). When unset
/// - unit tests, offline runs - no exporter is registered and nothing throws.
///
/// Trace-context propagation to the Resolver is automatic: the HttpClient
/// instrumentation injects the W3C traceparent header on every outbound call,
/// so a bank-initiated ceremony shows up as one connected trace across services.
/// </summary>
public static class Observability
{
    public static WebApplicationBuilder AddBankObservability(
        this WebApplicationBuilder builder,
        string serviceName = "ohpp.bank")
    {
        var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var hasOtlp = !string.IsNullOrWhiteSpace(otlpEndpoint);
        var version = typeof(Observability).Assembly.GetName().Version?.ToString() ?? "0.0.0";

        var resource = ResourceBuilder.CreateDefault().AddService(serviceName, serviceVersion: version);

        var otel = builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(serviceName, serviceVersion: version))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.Filter = context =>
                            !context.Request.Path.StartsWithSegments("/health");
                    })
                    .AddHttpClientInstrumentation();
                if (hasOtlp) tracing.AddOtlpExporter();
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
                if (hasOtlp) metrics.AddOtlpExporter();
            });

        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.SetResourceBuilder(resource);
            logging.IncludeScopes = true;
            logging.IncludeFormattedMessage = true;
            if (hasOtlp) logging.AddOtlpExporter();
        });

        return builder;
    }
}
