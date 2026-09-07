using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.OpenTelemetry;

namespace OHPP.Infrastructure.Serilog;

public static class SerilogConfiguration
{
    /// <summary>
    /// Configures Serilog with structured output, enrichers, and token redaction.
    ///
    /// When OTEL_EXPORTER_OTLP_ENDPOINT is set, logs are ALSO shipped to the
    /// OpenTelemetry Collector via OTLP (U7.1), carrying service.name so they
    /// appear in Grafana/Loki alongside traces and metrics. Fail-open: if the
    /// endpoint is unset the OTLP sink is not added; if the collector is down
    /// the sink drops silently and never blocks the app.
    /// </summary>
    public static IHostBuilder UseOhppSerilog(
        this IHostBuilder hostBuilder,
        string serviceName = "OHPP.Resolver")
    {
        return hostBuilder.UseSerilog((context, configuration) =>
        {
            configuration
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
                .MinimumLevel.Override("System.Net.Http.HttpClient", LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", serviceName)
                .Destructure.ByTransforming<RedactedToken>(t => new { Token = "***REDACTED***" })
                .WriteTo.Console(
                    outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}{NewLine}  {Message:lj}{NewLine}{Exception}");

            var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
            if (!string.IsNullOrWhiteSpace(otlpEndpoint))
            {
                configuration.WriteTo.OpenTelemetry(options =>
                {
                    options.Endpoint = otlpEndpoint;
                    options.Protocol = OtlpProtocol.Grpc;
                    options.ResourceAttributes = new Dictionary<string, object>
                    {
                        ["service.name"] = serviceName,
                    };
                });
            }
        });
    }
}

/// <summary>
/// Marker type used with Serilog destructuring to redact tokens from log output.
/// Wrap sensitive token values in this type before logging.
/// </summary>
public sealed class RedactedToken
{
    public string Value { get; }

    public RedactedToken(string value)
    {
        Value = value;
    }

    public override string ToString() => "***REDACTED***";
}
