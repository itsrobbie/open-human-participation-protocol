using OHPP.Domain.Auth;

namespace OHPP.Presentation.Api.Auth;

public static class AuthExtensions
{
    private const string PrincipalKey = "AuthenticatedPrincipal";

    public static void SetAuthenticatedPrincipal(this HttpContext context, AuthenticatedPrincipal principal)
    {
        context.Items[PrincipalKey] = principal;
    }

    public static AuthenticatedPrincipal? GetAuthenticatedPrincipal(this HttpContext context)
    {
        return context.Items.TryGetValue(PrincipalKey, out var value)
            ? value as AuthenticatedPrincipal
            : null;
    }
}
