namespace OHPP.Domain.Participation;

public interface INotificationChannel
{
    Task NotifyDevicesAsync(Guid userId, string eventType, string payload, CancellationToken cancellationToken = default);
    bool HasActiveConnections(Guid userId);
}
