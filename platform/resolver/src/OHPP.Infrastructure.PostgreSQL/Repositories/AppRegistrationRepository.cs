using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Registration;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class AppRegistrationRepository : IAppRegistrationRepository
{
    private readonly AppDbContext _db;

    public AppRegistrationRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AppRegistration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.AppRegistrations.FindAsync(new object[] { id }, cancellationToken);
    }

    public async Task<AppRegistration?> GetActiveByUserAndAppIdAsync(Guid userId, string appId, CancellationToken cancellationToken = default)
    {
        return await _db.AppRegistrations
            .FirstOrDefaultAsync(r => r.UserId == userId && r.AppId == appId && r.RevokedAt == null, cancellationToken);
    }

    public async Task<IReadOnlyList<AppRegistration>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.AppRegistrations
            .Where(r => r.UserId == userId)
            .ToListAsync(cancellationToken);
    }

    public async Task<AppRegistration> CreateAsync(AppRegistration registration, CancellationToken cancellationToken = default)
    {
        _db.AppRegistrations.Add(registration);
        await _db.SaveChangesAsync(cancellationToken);
        return registration;
    }

    public async Task UpdateAsync(AppRegistration registration, CancellationToken cancellationToken = default)
    {
        _db.AppRegistrations.Update(registration);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
