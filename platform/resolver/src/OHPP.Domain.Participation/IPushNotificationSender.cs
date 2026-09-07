namespace OHPP.Domain.Participation;

public interface IPushNotificationSender
{
    /// <summary>
    /// Sends a push notification to all registered device tokens for a user.
    /// Returns the list of tokens that failed (so caller can clean them up).
    /// </summary>
    Task<IReadOnlyList<string>> SendToUserDevicesAsync(
        IReadOnlyList<string> pushTokens,
        PushPayload payload,
        CancellationToken cancellationToken = default);
}

public sealed class PushPayload
{
    public required Guid RequestId { get; init; }
    public required string AppId { get; init; }
    public required string Summary { get; init; }
    public string? Category { get; init; }
}
