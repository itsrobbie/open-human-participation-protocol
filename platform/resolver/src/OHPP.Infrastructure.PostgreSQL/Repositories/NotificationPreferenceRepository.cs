using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class NotificationPreferenceRepository : INotificationPreferenceRepository
{
    private readonly AppDbContext _db;

    public NotificationPreferenceRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<NotificationPreference>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.NotificationPreferences
            .Where(n => n.UserId == userId)
            .ToListAsync(cancellationToken);
    }

    public async Task<NotificationPreference?> GetByUserAndAppAsync(Guid userId, string appId, CancellationToken cancellationToken = default)
    {
        return await _db.NotificationPreferences
            .FirstOrDefaultAsync(n => n.UserId == userId && n.AppId == appId, cancellationToken);
    }

    public async Task<NotificationPreference> CreateOrUpdateAsync(NotificationPreference preference, CancellationToken cancellationToken = default)
    {
        var existing = await GetByUserAndAppAsync(preference.UserId, preference.AppId, cancellationToken);

        if (existing is not null)
        {
            existing.PushEnabled = preference.PushEnabled;
            existing.SoundEnabled = preference.SoundEnabled;
            existing.BadgeEnabled = preference.BadgeEnabled;
            existing.UpdatedAt = preference.UpdatedAt;
            _db.NotificationPreferences.Update(existing);
            await _db.SaveChangesAsync(cancellationToken);
            return existing;
        }

        _db.NotificationPreferences.Add(preference);
        await _db.SaveChangesAsync(cancellationToken);
        return preference;
    }
}
