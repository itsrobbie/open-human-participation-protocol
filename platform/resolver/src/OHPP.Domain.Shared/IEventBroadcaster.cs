namespace OHPP.Domain.Shared;

public interface IEventBroadcaster
{
    Task PublishAsync(Guid userId, string eventType, string payload, CancellationToken cancellationToken = default);
}
