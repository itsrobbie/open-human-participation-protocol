using OHPP.Domain.Shared;

namespace OHPP.Domain.Auth;

public interface IAuthenticationService
{
    Task<Result<AuthenticatedPrincipal>> ResolveIdentityTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<Result<AuthenticatedPrincipal>> ResolveDeviceTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<Result<AuthenticatedPrincipal>> ResolveAppTokenAsync(string token, CancellationToken cancellationToken = default);
}
