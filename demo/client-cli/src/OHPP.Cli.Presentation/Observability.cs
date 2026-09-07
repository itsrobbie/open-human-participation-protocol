using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace OHPP.Cli.Presentation;

/// <summary>
/// Self-contained OpenTelemetry wiring for the CLI attester simulator (U7.1).
///
/// The CLI is a plain console app (no ASP.NET, no DI host), so it builds its own
/// TracerProvider / MeterProvider directly with the standard OpenTelemetry SDK -
/// exactly as an integrator would instrument a console tool. Depends only on the
/// standard OpenTelemetry packages; no shared OHPP infra project.
///
/// Config-driven and fail-open: providers export only when
/// OTEL_EXPORTER_OTLP_ENDPOINT is set (the OTel Collector in dev). When unset,
/// <see cref="Init"/> returns a no-op disposable and nothing throws.
///
/// The HttpClient instrumentation injects the W3C traceparent header on every
/// outbound call, so the CLI's requests to the Resolver join the same trace as
/// the app that initiated the ceremony.
/// </summary>
public static class Observability
{
    /// <summary>
    /// Initialise process-wide telemetry. Keep the returned handle alive for the
    /// lifetime of the process (dispose flushes on shutdown). Safe to ignore when
    /// telemetry is disabled.
    /// </summary>
    public static IDisposable Init(string serviceName = "ohpp.cli")
    {
        var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        if (string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            return new NoopDisposable();
        }

        var version = typeof(Observability).Assembly.GetName().Version?.ToString() ?? "0.0.0";
        var resource = ResourceBuilder.CreateDefault().AddService(serviceName, serviceVersion: version);

        var tracerProvider = OpenTelemetry.Sdk.CreateTracerProviderBuilder()
            .SetResourceBuilder(resource)
            .AddHttpClientInstrumentation()
            .AddOtlpExporter()
            .Build();

        var meterProvider = OpenTelemetry.Sdk.CreateMeterProviderBuilder()
            .SetResourceBuilder(resource)
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddOtlpExporter()
            .Build();

        return new TelemetryHandle(tracerProvider, meterProvider);
    }

    private sealed class TelemetryHandle : IDisposable
    {
        private readonly TracerProvider? _tracerProvider;
        private readonly MeterProvider? _meterProvider;

        public TelemetryHandle(TracerProvider? tracerProvider, MeterProvider? meterProvider)
        {
            _tracerProvider = tracerProvider;
            _meterProvider = meterProvider;
        }

        public void Dispose()
        {
            // Best-effort flush; never throw on shutdown.
            try { _tracerProvider?.Dispose(); } catch { /* fail-open */ }
            try { _meterProvider?.Dispose(); } catch { /* fail-open */ }
        }
    }

    private sealed class NoopDisposable : IDisposable
    {
        public void Dispose() { }
    }
}
