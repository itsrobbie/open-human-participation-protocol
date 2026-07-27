using OHPP.Domain.Shared;

namespace OHPP.Domain.Participation;

public interface IRequestLifecycleManager
{
    Task<Result<PendingRequest>> GetStatusAsync(
        Guid requestId,
        Guid appRegistrationId,
        CancellationToken cancellationToken = default);

    Task<Result<bool>> CancelRequestAsync(
        Guid requestId,
        Guid appRegistrationId,
        CancellationToken cancellationToken = default);
}
