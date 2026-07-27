using OHPP.Domain.Shared;

namespace OHPP.Domain.Auth;

public interface IUserProfileService
{
    Task<User> GetOrCreateFromClaimsAsync(IdentityTokenClaims claims, CancellationToken cancellationToken = default);
    Task<Result<User>> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
