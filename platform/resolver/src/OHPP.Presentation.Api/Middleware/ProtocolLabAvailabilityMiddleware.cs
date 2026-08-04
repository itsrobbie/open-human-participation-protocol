namespace OHPP.Presentation.Api.Middleware;

/// <summary>
/// Keeps the development-only Protocol Lab unavailable unless it is explicitly enabled.
/// This check runs before token processing so direct requests receive the same 404 response.
/// </summary>
public sealed class ProtocolLabAvailabilityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _enabled;

    public ProtocolLabAvailabilityMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _enabled = configuration.GetValue<bool>("Features:ProtocolLab");
    }

    public Task InvokeAsync(HttpContext context)
    {
        if (!_enabled && (context.Request.Path.StartsWithSegments("/api/protocol-lab") ||
            context.Request.Path.Value == "/.well-known/ohpp/app-metadata"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return Task.CompletedTask;
        }

        return _next(context);
    }
}
