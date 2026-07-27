using System.Text.Json;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Presentation.Api.Auth;

namespace OHPP.Presentation.Api.Middleware;

/// <summary>
/// Applies per-token rate limiting to authenticated API requests.
/// Anonymous endpoints (health, metadata, JWKS) are not rate-limited here.
/// </summary>
public sealed class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private const int MaxRequestsPerMinute = 60;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public RateLimitingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var principal = context.GetAuthenticatedPrincipal();
        if (principal is null)
        {
            await _next(context);
            return;
        }

        var rateLimitKey = principal.TokenType switch
        {
            TokenType.AppAccess => $"app:{principal.AppRegistrationId}",
            TokenType.Device => $"device:{principal.DeviceId}",
            TokenType.IdentityProvider => $"user:{principal.UserId}",
            _ => null
        };

        if (rateLimitKey is null)
        {
            await _next(context);
            return;
        }

        var rateLimitStore = context.RequestServices.GetRequiredService<IRateLimitStore>();

        if (await rateLimitStore.IsRateLimitedAsync(rateLimitKey, MaxRequestsPerMinute, Window))
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.ContentType = "application/json";
            context.Response.Headers["Retry-After"] = "60";

            var response = new { error = new { code = "RATE_LIMITED", message = "Too many requests. Try again later." } };
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
            return;
        }

        await rateLimitStore.IncrementAsync(rateLimitKey, Window);
        await _next(context);
    }
}
