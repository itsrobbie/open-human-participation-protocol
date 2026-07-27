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
        var payload = JsonSerializer.Serialize(new
        {
            requestId = request.Id,
            appId = request.AppId,
            actionSummary = request.ActionSummary,
            type = request.Type,
            expiresAt = request.ExpiresAt?.ToString("O")
        });

        await _channel.NotifyDevicesAsync(userId, "new_request", payload, cancellationToken);
        return true;
    }
}
