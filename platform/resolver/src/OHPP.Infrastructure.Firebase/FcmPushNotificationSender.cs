using FirebaseAdmin.Messaging;
using Microsoft.Extensions.Logging;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.Firebase;

public sealed class FcmPushNotificationSender : IPushNotificationSender
{
    private readonly ILogger<FcmPushNotificationSender> _logger;

    public FcmPushNotificationSender(ILogger<FcmPushNotificationSender> logger)
    {
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> SendToUserDevicesAsync(
        IReadOnlyList<string> pushTokens,
        PushPayload payload,
        CancellationToken cancellationToken = default)
    {
        if (pushTokens.Count == 0)
            return Array.Empty<string>();

        var failedTokens = new List<string>();

        var message = new MulticastMessage
        {
            Tokens = pushTokens.ToList(),
            Data = new Dictionary<string, string>
            {
                ["requestId"] = payload.RequestId.ToString(),
                ["appId"] = payload.AppId,
                ["summary"] = payload.Summary,
                ["category"] = payload.Category ?? ""
            },
            Notification = new Notification
            {
                Title = payload.AppId,
                Body = payload.Summary
            },
            Android = new AndroidConfig
            {
                Priority = Priority.High
            },
            Apns = new ApnsConfig
            {
                Headers = new Dictionary<string, string>
                {
                    ["apns-priority"] = "10"
                }
            }
        };

        try
        {
            var response = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(message, cancellationToken);

            for (var i = 0; i < response.Responses.Count; i++)
            {
                if (!response.Responses[i].IsSuccess)
                {
                    var errorCode = response.Responses[i].Exception?.MessagingErrorCode;
                    if (errorCode is MessagingErrorCode.Unregistered or MessagingErrorCode.InvalidArgument)
                    {
                        failedTokens.Add(pushTokens[i]);
                        _logger.LogWarning("Push token invalid/unregistered, marking for removal: {ErrorCode}", errorCode);
                    }
                    else
                    {
                        _logger.LogWarning("Push send failed for token (transient): {ErrorCode}", errorCode);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FCM push dispatch failed entirely");
            // Don't throw - push is best-effort, app still works via polling
        }

        return failedTokens;
    }
}
