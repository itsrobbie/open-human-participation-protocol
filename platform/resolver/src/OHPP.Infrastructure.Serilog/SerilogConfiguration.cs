using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;

namespace OHPP.Infrastructure.Serilog;

public static class SerilogConfiguration
{
    /// <summary>
    /// Configures Serilog with structured JSON output, enrichers, and token redaction.
    /// </summary>
    public static IHostBuilder UseOhppSerilog(this IHostBuilder hostBuilder)
    {
        return hostBuilder.UseSerilog((context, configuration) =>
        {
            configuration
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
                .MinimumLevel.Override("System.Net.Http.HttpClient", LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", "OHPP.Resolver")
                .Destructure.ByTransforming<RedactedToken>(t => new { Token = "***REDACTED***" })
                .WriteTo.Console(
                    outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}{NewLine}  {Message:lj}{NewLine}{Exception}");
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
