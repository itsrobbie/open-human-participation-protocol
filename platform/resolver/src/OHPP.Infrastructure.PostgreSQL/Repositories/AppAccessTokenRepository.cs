using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class AppAccessTokenRepository : IAppAccessTokenRepository
{
    private readonly AppDbContext _db;

    public AppAccessTokenRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AppRegistrationToken?> GetByTokenAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        return await _db.AppRegistrations
            .Where(r => r.AccessToken == accessToken)
            .Select(r => new AppRegistrationToken
            {
                AppRegistrationId = r.Id,
                UserId = r.UserId,
                AppId = r.AppId,
                RevokedAt = r.RevokedAt
            })
            .FirstOrDefaultAsync(cancellationToken);
    }
}
