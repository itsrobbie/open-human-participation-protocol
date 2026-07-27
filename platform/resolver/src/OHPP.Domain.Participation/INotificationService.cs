namespace OHPP.Domain.Participation;

public interface INotificationService
{
    Task<bool> NotifyNewRequestAsync(
        Guid userId,
        PendingRequest request,
        CancellationToken cancellationToken = default);
}
