using OHPP.Domain.Auth;
using OHPP.Presentation.Api.Auth;
using OHPP.Sdk.Server;

namespace OHPP.Presentation.Api;

/// <summary>
/// Bridges the Resolver's AuthenticatedPrincipal (set by TokenDiscriminationMiddleware)
/// to the SDK Server's IOhppAuthContextAccessor interface.
/// Returns context only for AppAccess token types.
/// </summary>
public sealed class OhppAuthContextAccessor : IOhppAuthContextAccessor
{
    public OhppAppAuthContext? GetAppContext(HttpContext context)
    {
        var principal = context.GetAuthenticatedPrincipal();
        if (principal is null || principal.TokenType != TokenType.AppAccess)
            return null;

        if (principal.AppRegistrationId is null || principal.AppId is null)
            return null;

        return new OhppAppAuthContext
        {
            AppRegistrationId = principal.AppRegistrationId.Value,
            UserId = principal.UserId,
            AppId = principal.AppId
        };
    }
}
