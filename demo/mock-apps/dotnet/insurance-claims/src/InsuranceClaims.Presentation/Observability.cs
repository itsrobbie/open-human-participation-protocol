using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace InsuranceClaims.Presentation;

/// <summary>
/// Self-contained OpenTelemetry wiring for the Demo Insurance Claims app (U7.1).
///
/// This mock app models an independent third-party company integrating with
/// OHPP, so its observability depends only on the standard OpenTelemetry NuGet
/// packages - exactly as a real integrator would wire it. No shared OHPP infra
/// project is referenced.
///
/// Config-driven and fail-open: telemetry is exported only when
/// OTEL_EXPORTER_OTLP_ENDPOINT is set (the OTel Collector in dev). When unset,
/// no exporter is registered and nothing throws.
///
/// Trace-context propagation to the Resolver is automatic via the HttpClient
/// instrumentation (W3C traceparent injected on outbound calls), so a
/// claims-initiated ceremony appears as one connected cross-service trace.
/// </summary>
public static class Observability
{
    public static WebApplicationBuilder AddInsuranceObservability(
        this WebApplicationBuilder builder,
        string serviceName = "ohpp.insurance")
    {
        var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var hasOtlp = !string.IsNullOrWhiteSpace(otlpEndpoint);
        var version = typeof(Observability).Assembly.GetName().Version?.ToString() ?? "0.0.0";

        var resource = ResourceBuilder.CreateDefault().AddService(serviceName, serviceVersion: version);

        builder.Services.AddOpenTelemetry()
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
