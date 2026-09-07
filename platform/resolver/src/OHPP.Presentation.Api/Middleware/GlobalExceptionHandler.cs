using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using OHPP.Infrastructure.OpenTelemetry;

namespace OHPP.Presentation.Api.Middleware;

public sealed class GlobalExceptionHandler
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(RequestDelegate next, ILogger<GlobalExceptionHandler> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Surface the crash as an OpenTelemetry error span (U7.1, Phase 4).
            // Because this middleware swallows the exception to return a clean 500,
            // the ASP.NET OTel instrumentation would otherwise never see it as an
            // exception - so we record it on the active span explicitly, with the
            // OHPP request id when present so a crash is filterable in Grafana.
            RecordExceptionOnActiveSpan(context, ex);

            _logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static void RecordExceptionOnActiveSpan(HttpContext context, Exception exception)
    {
        var activity = Activity.Current;
        if (activity is null)
        {
            return;
        }

        // Record as an OTel exception event using the standard semantic-convention
        // tags (built by the pure, unit-tested helper), then mark the span status
        // Error. Done manually rather than via a DiagnosticSource extension so it
        // works regardless of package version. Tempo/Grafana surface this as an
        // error with the stack trace.
        var exceptionTags = new ActivityTagsCollection();
        foreach (var kvp in OhppTelemetryEnrichment.BuildExceptionTags(exception))
        {
            exceptionTags[kvp.Key] = kvp.Value;
        }
        activity.AddEvent(new ActivityEvent("exception", tags: exceptionTags));
        activity.SetStatus(ActivityStatusCode.Error, exception.Message);

        // Attach the OHPP request id if it's on the route, so the error span is
        // joinable to the ceremony that triggered it.
        var routeValues = context.Request.RouteValues;
        var requestId = OhppTelemetryEnrichment.ResolveRequestId(
            routeValues.TryGetValue("requestId", out var rid) ? rid?.ToString() : null,
            routeValues.TryGetValue("id", out var id) ? id?.ToString() : null);
        if (requestId is not null)
        {
            activity.SetTag(OhppTelemetryEnrichment.RequestIdKey, requestId);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var env = context.RequestServices?.GetService<IWebHostEnvironment>();
        var isDev = env?.EnvironmentName == "Development";

        var response = isDev
            ? new { error = new { code = "INTERNAL_ERROR", message = exception.Message, detail = exception.ToString() } }
            : (object)new { error = new { code = "INTERNAL_ERROR", message = "An unexpected error occurred." } };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
