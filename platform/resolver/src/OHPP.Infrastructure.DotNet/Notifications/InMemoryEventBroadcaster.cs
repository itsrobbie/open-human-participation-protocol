using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.DotNet.Notifications;

public sealed class InMemoryEventBroadcaster : IEventBroadcaster
{
    private readonly SseNotificationChannel _channel;

    public InMemoryEventBroadcaster(SseNotificationChannel channel)
    {
        _channel = channel;
    }

    public Task PublishAsync(Guid userId, string eventType, string payload, CancellationToken cancellationToken = default)
    {
        return _channel.NotifyDevicesAsync(userId, eventType, payload, cancellationToken);
    }
}
