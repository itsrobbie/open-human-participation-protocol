namespace OHPP.Domain.Participation;

public interface INotificationPreferenceRepository
{
    Task<IReadOnlyList<NotificationPreference>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<NotificationPreference?> GetByUserAndAppAsync(Guid userId, string appId, CancellationToken cancellationToken = default);
    Task<NotificationPreference> CreateOrUpdateAsync(NotificationPreference preference, CancellationToken cancellationToken = default);
}
