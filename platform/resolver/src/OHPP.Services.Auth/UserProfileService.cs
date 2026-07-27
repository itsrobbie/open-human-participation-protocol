using OHPP.Domain.Auth;
using OHPP.Domain.Shared;

namespace OHPP.Services.Auth;

public class UserProfileService : IUserProfileService
{
    private readonly IUserRepository _userRepo;
    private readonly IClock _clock;

    public UserProfileService(IUserRepository userRepo, IClock clock)
    {
        _userRepo = userRepo;
        _clock = clock;
    }

    public async Task<User> GetOrCreateFromClaimsAsync(
        IdentityTokenClaims claims, CancellationToken cancellationToken = default)
    {
        var user = await _userRepo.GetByExternalIdAsync(claims.ExternalId, cancellationToken);

        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                ExternalId = claims.ExternalId,
                Email = claims.Email,
                DisplayName = claims.DisplayName ?? claims.Email,
                CreatedAt = _clock.UtcNow,
                LastLoginAt = _clock.UtcNow
            };
            return await _userRepo.CreateAsync(user, cancellationToken);
        }

        user.LastLoginAt = _clock.UtcNow;
        await _userRepo.UpdateAsync(user, cancellationToken);
        return user;
    }

    public async Task<Result<User>> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, cancellationToken);
        if (user is null)
            return Error.NotFound("User not found");
        return user;
    }
}
