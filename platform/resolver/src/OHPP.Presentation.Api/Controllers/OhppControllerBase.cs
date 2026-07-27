using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;
using OHPP.Presentation.Api.Auth;

namespace OHPP.Presentation.Api.Controllers;

/// <summary>
/// Base controller providing access to the authenticated principal set by TokenDiscriminationMiddleware.
/// </summary>
[ApiController]
public abstract class OhppControllerBase : ControllerBase
{
    protected AuthenticatedPrincipal? Principal => HttpContext.GetAuthenticatedPrincipal();

    protected Guid UserId => Principal!.UserId;
}
