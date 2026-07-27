using OHPP.Domain.Auth;
using OHPP.Presentation.Api.Auth;

namespace OHPP.Presentation.Api.Middleware;

/// <summary>
/// Extracts the Bearer token from the Authorization header, determines its type,
/// resolves the authenticated principal, and stores it in HttpContext.Items.
/// Endpoints that don't require auth (health, metadata, JWKS) skip this.
/// </summary>
public sealed class TokenDiscriminationMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly HashSet<string> AnonymousPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/health",
        "/health/ready",
        "/.well-known/ohpp/metadata",
        "/.well-known/ohpp/keys"
    };

    public TokenDiscriminationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        if (AnonymousPaths.Contains(path))
        {
            await _next(context);
            return;
        }

        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var token = authHeader["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(token))
        {
            await _next(context);
            return;
        }

        var discriminationService = context.RequestServices.GetRequiredService<ITokenDiscriminationService>();
        var tokenType = discriminationService.DetermineTokenType(token);

        var authService = context.RequestServices.GetRequiredService<IAuthenticationService>();

        AuthenticatedPrincipal? principal = null;

        switch (tokenType)
        {
            case TokenType.IdentityProvider:
                var identityResult = await authService.ResolveIdentityTokenAsync(token);
                if (identityResult.IsSuccess)
                    principal = identityResult.Value;
                break;

            case TokenType.Device:
                var deviceResult = await authService.ResolveDeviceTokenAsync(token);
                if (deviceResult.IsSuccess)
                    principal = deviceResult.Value;
                break;

            case TokenType.AppAccess:
                var appResult = await authService.ResolveAppTokenAsync(token);
                if (appResult.IsSuccess)
                    principal = appResult.Value;
                break;
        }

        if (principal is not null)
        {
            context.SetAuthenticatedPrincipal(principal);
        }

        await _next(context);
    }
}
