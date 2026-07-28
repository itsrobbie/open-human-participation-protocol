using System.Text.Json;
using Microsoft.AspNetCore.Hosting;

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
            _logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
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
