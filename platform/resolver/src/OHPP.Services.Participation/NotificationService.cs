using System.Text.Json;
using OHPP.Domain.Participation;

namespace OHPP.Services.Participation;

public sealed class NotificationService : INotificationService
{
    private readonly INotificationChannel _channel;

    public NotificationService(INotificationChannel channel)
    {
        _channel = channel;
    }

    public async Task<bool> NotifyNewRequestAsync(
        Guid userId,
        PendingRequest request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(DeviceParticipationRequestMapper.Map(request));

        await _channel.NotifyDevicesAsync(userId, "new_request", payload, cancellationToken);
        return true;
    }
}
