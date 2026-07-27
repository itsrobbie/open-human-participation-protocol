using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using OHPP.Domain.Auth;
using OHPP.Presentation.Api.Auth;

namespace OHPP.Presentation.Api.Filters;

/// <summary>
/// Action filter that enforces the required token type for an endpoint.
/// Returns 401 if no principal or wrong token type.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireTokenTypeAttribute : Attribute, IAsyncActionFilter
{
    private readonly TokenType _requiredType;

    public RequireTokenTypeAttribute(TokenType requiredType)
    {
        _requiredType = requiredType;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var principal = context.HttpContext.GetAuthenticatedPrincipal();

        if (principal is null || principal.TokenType != _requiredType)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        await next();
    }
}
