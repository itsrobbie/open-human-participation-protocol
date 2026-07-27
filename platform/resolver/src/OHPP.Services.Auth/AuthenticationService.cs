using OHPP.Domain.Auth;
using OHPP.Domain.Shared;

namespace OHPP.Services.Auth;

public class AuthenticationService : IAuthenticationService
{
    private readonly IIdentityTokenValidator _identityValidator;
    private readonly IDeviceTokenRepository _deviceRepo;
    private readonly IAppAccessTokenRepository _appTokenRepo;
    private readonly IUserProfileService _userProfileService;

    public AuthenticationService(
        IIdentityTokenValidator identityValidator,
        IDeviceTokenRepository deviceRepo,
        IAppAccessTokenRepository appTokenRepo,
        IUserProfileService userProfileService)
    {
        _identityValidator = identityValidator;
        _deviceRepo = deviceRepo;
        _appTokenRepo = appTokenRepo;
        _userProfileService = userProfileService;
    }

    public async Task<Result<AuthenticatedPrincipal>> ResolveIdentityTokenAsync(
        string token, CancellationToken cancellationToken = default)
    {
        IdentityTokenClaims claims;
        try
        {
            claims = await _identityValidator.ValidateAsync(token, cancellationToken);
        }
        catch (Exception)
        {
            return Error.Unauthorized("Identity token validation failed");
        }

        var user = await _userProfileService.GetOrCreateFromClaimsAsync(claims, cancellationToken);

        return new AuthenticatedPrincipal
        {
            UserId = user.Id,
            TokenType = TokenType.IdentityProvider
        };
    }

    public async Task<Result<AuthenticatedPrincipal>> ResolveDeviceTokenAsync(
        string token, CancellationToken cancellationToken = default)
    {
        var device = await _deviceRepo.GetByTokenAsync(token, cancellationToken);

        if (device is null)
            return Error.Unauthorized("Unknown device token");

        if (!device.IsActive)
            return Error.Unauthorized("Device has been revoked");

        return new AuthenticatedPrincipal
        {
            UserId = device.UserId,
            TokenType = TokenType.Device,
            DeviceId = device.Id
        };
    }

    public async Task<Result<AuthenticatedPrincipal>> ResolveAppTokenAsync(
        string token, CancellationToken cancellationToken = default)
    {
        var registration = await _appTokenRepo.GetByTokenAsync(token, cancellationToken);

        if (registration is null)
            return Error.Unauthorized("Unknown app access token");

        if (registration.RevokedAt.HasValue)
            return Error.Unauthorized("App registration has been revoked");

        return new AuthenticatedPrincipal
        {
            UserId = registration.UserId,
            TokenType = TokenType.AppAccess,
            AppRegistrationId = registration.AppRegistrationId,
            AppId = registration.AppId
        };
    }
}
