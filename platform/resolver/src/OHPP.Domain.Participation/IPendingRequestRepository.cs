using OHPP.Domain.Shared;

namespace OHPP.Domain.Participation;

public interface IPendingRequestRepository
{
    Task<PendingRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PendingRequest?> GetByIdForAppAsync(Guid id, Guid appRegistrationId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PendingRequest>> GetPendingByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PendingRequest>> GetExpiredPendingAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<PendingRequest> CreateAsync(PendingRequest request, CancellationToken cancellationToken = default);
    Task UpdateStatusAsync(Guid id, string status, DateTimeOffset? resolvedAt, CancellationToken cancellationToken = default);
    Task<bool> TryUpdateStatusAsync(Guid id, string expectedStatus, string status, DateTimeOffset? resolvedAt, CancellationToken cancellationToken = default);
    Task CancelAllForAppRegistrationAsync(Guid appRegistrationId, CancellationToken cancellationToken = default);
    Task<int> CountPendingByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
