using Microsoft.Extensions.Logging;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.DotNet.Notifications;

/// <summary>
/// The default push dispatcher. Does nothing and reports no failed tokens.
///
/// Push (FCM/APNs) is a production-only delivery path: it needs real Firebase
/// credentials and a physical device. In local/dev and test environments the app
/// receives new requests over the two always-on channels instead - Server-Sent
/// Events (real-time, for connected devices) and polling (the durable fallback).
///
/// Formalizing the seam this way means <see cref="IPushNotificationSender"/> is
/// ALWAYS registered (as at least this no-op), so <c>NotificationService</c> no
/// longer needs a nullable/optional dependency and the "push is off in dev"
/// behavior is explicit and testable rather than implied by an absent registration.
///
/// The production implementation is <c>FcmPushNotificationSender</c> in
/// OHPP.Infrastructure.Firebase, which overrides this default only when Firebase
/// credentials are available.
/// </summary>
public sealed class NoOpPushNotificationSender : IPushNotificationSender
{
    private readonly ILogger<NoOpPushNotificationSender>? _logger;

    public NoOpPushNotificationSender(ILogger<NoOpPushNotificationSender>? logger = null)
    {
        _logger = logger;
    }

    public Task<IReadOnlyList<string>> SendToUserDevicesAsync(
        IReadOnlyList<string> pushTokens,
        PushPayload payload,
        CancellationToken cancellationToken = default)
    {
        _logger?.LogDebug(
            "Push dispatch is a no-op in this environment (dev/test); delivering request {RequestId} via SSE + polling only.",
            payload.RequestId);

        // Nothing sent, so no tokens failed and nothing needs cleanup.
        return Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());
    }
}
