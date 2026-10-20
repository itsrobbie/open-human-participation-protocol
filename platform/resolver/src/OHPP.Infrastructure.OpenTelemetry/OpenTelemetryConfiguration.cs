using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace OHPP.Infrastructure.OpenTelemetry;

public static class OpenTelemetryConfiguration
{
    /// <summary>
    /// Configures OpenTelemetry (traces + metrics + logs) for the Resolver.
    ///
    /// Exporter selection is config-driven and fail-open (NFR-A1, NFR-Rel1):
    /// - If OTEL_EXPORTER_OTLP_ENDPOINT is set, export via OTLP to that endpoint
    ///   (the OTel Collector in dev).
    /// - If unset, no OTLP exporter is added (safe default for unit tests / offline);
    ///   a console exporter is used for traces so local runs still show activity.
    /// </summary>
    public static IServiceCollection AddOhppOpenTelemetry(
        this IServiceCollection services,
        string serviceName = "OHPP.Resolver")
    {
        var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var hasOtlp = !string.IsNullOrWhiteSpace(otlpEndpoint);
        var version = typeof(OpenTelemetryConfiguration).Assembly.GetName().Version?.ToString() ?? "0.0.0";

        // U9: the env wins over the hardcoded name so a tenant app tier can set
        // its own service name. OTEL_RESOURCE_ATTRIBUTES (e.g.
        // deployment.environment=stack-1,service.instance.id=1) is picked up by
        // the standard env-variable detector, keeping parallel stacks separable
        // in the shared observability backend.
        var envServiceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME");
        var effectiveServiceName = string.IsNullOrWhiteSpace(envServiceName) ? serviceName : envServiceName;

        services.AddOpenTelemetry()
            .ConfigureResource(resource =>
            {
                resource.AddService(serviceName: effectiveServiceName, serviceVersion: version);
                resource.AddEnvironmentVariableDetector();
            })
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.Filter = context =>
                            !context.Request.Path.StartsWithSegments("/health");
                        // Stamp the OHPP request id onto the server span when present
                        // in the route, so a ceremony is filterable by ohpp.request_id.
                        options.EnrichWithHttpRequest = (activity, request) =>
                        {
                            var requestId = ExtractRequestId(request);
                            if (!string.IsNullOrWhiteSpace(requestId))
                            {
                                activity.SetTag(OhppTelemetryEnrichment.RequestIdKey, requestId);
                            }
                        };
                    })
                    .AddHttpClientInstrumentation();

                if (hasOtlp)
                {
                    tracing.AddOtlpExporter();
                }
                else
                {
                    tracing.AddConsoleExporter();
                }
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();

                if (hasOtlp)
                {
                    metrics.AddOtlpExporter();
                }
            });

        // Logs: route through OpenTelemetry to OTLP when configured.
        services.AddLogging(logging =>
        {
            logging.AddOpenTelemetry(otelLogging =>
            {
                otelLogging.SetResourceBuilder(
                    ResourceBuilder.CreateDefault()
                        .AddService(effectiveServiceName, serviceVersion: version)
                        .AddEnvironmentVariableDetector());
                otelLogging.IncludeScopes = true;
                otelLogging.IncludeFormattedMessage = true;
                if (hasOtlp)
                {
                    otelLogging.AddOtlpExporter();
                }
            });
        });

        return services;
    }

    /// <summary>
    /// Extracts the OHPP request id from a request's route values when the route
    /// defines a {requestId} or {id} guid parameter. Returns null when absent.
    /// Kept internal-simple and null-safe; never throws.
    /// </summary>
    private static string? ExtractRequestId(HttpRequest request)
    {
        var routeValues = request.HttpContext.Request.RouteValues;
        if (routeValues.TryGetValue("requestId", out var rid) && rid is not null)
        {
            return rid.ToString();
        }
        if (routeValues.TryGetValue("id", out var id) && id is not null)
        {
            return id.ToString();
        }
        return null;
    }
}
