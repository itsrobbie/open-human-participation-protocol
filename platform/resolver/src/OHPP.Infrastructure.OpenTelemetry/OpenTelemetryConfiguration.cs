using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace OHPP.Infrastructure.OpenTelemetry;

public static class OpenTelemetryConfiguration
{
    /// <summary>
    /// Configures OpenTelemetry tracing for the OHPP Resolver.
    /// </summary>
    public static IServiceCollection AddOhppOpenTelemetry(this IServiceCollection services)
    {
        services.AddOpenTelemetry()
            .ConfigureResource(resource =>
            {
                resource.AddService(
                    serviceName: "OHPP.Resolver",
                    serviceVersion: typeof(OpenTelemetryConfiguration).Assembly.GetName().Version?.ToString() ?? "0.0.0");
            })
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.Filter = context =>
                            !context.Request.Path.StartsWithSegments("/health");
                    })
                    .AddConsoleExporter();
            });

        return services;
    }
}
