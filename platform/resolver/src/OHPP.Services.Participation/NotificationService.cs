using System.Text.Json;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;

namespace OHPP.Services.Participation;

public sealed class NotificationService : INotificationService
{
    // The SSE new_request payload must use the same camelCase field names as the
    // GET /api/devices/me/pending HTTP response (which MVC serializes as camelCase).
    // Raw System.Text.Json defaults to PascalCase; without this the mobile client
    // parses nulls from the SSE frame and renders a blank request card.
    private static readonly JsonSerializerOptions SseJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly INotificationChannel _channel;
    private readonly IPushNotificationSender _pushSender;
    private readonly IDeviceTokenRepository _deviceRepo;

    public NotificationService(
        INotificationChannel channel,
        IDeviceTokenRepository deviceRepo,
        IPushNotificationSender pushSender)
    {
        _channel = channel;
        _deviceRepo = deviceRepo;
        // The push dispatcher is always present as at least a no-op (see
        // NoOpPushNotificationSender). SSE + polling are the real dev delivery
        // paths; FCM is production-only.
        _pushSender = pushSender;
    }

    public async Task<bool> NotifyNewRequestAsync(
        Guid userId,
        PendingRequest request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(DeviceParticipationRequestMapper.Map(request), SseJsonOptions);

        // SSE notification (for connected devices)
        await _channel.NotifyDevicesAsync(userId, "new_request", payload, cancellationToken);

        // Push dispatch (for offline/background devices). Runs through the push
        // dispatcher seam, which is a no-op in dev/test and FCM in production.
        try
        {
            var devices = await _deviceRepo.GetActiveByUserIdAsync(userId, cancellationToken);
            var pushTokens = devices
                .Where(d => !string.IsNullOrWhiteSpace(d.PushToken))
                .Select(d => d.PushToken!)
                .ToList();

            if (pushTokens.Count > 0)
            {
                var pushPayload = new PushPayload
                {
                    RequestId = request.Id,
                    AppId = request.AppId,
                    Summary = request.ActionSummary,
                    Category = null // Category not stored on PendingRequest directly
                };

                var failedTokens = await _pushSender.SendToUserDevicesAsync(pushTokens, pushPayload, cancellationToken);

                // Clean up invalid tokens
                if (failedTokens.Count > 0)
                {
                    foreach (var device in devices.Where(d => failedTokens.Contains(d.PushToken)))
                    {
                        device.PushToken = null;
                        await _deviceRepo.UpdateAsync(device, cancellationToken);
                    }
                }
            }
        }
        catch
        {
            // Push is best-effort. If the dispatcher is unavailable or throws,
            // we log at the sender level and continue. SSE was already sent.
        }

        return true;
    }
}
