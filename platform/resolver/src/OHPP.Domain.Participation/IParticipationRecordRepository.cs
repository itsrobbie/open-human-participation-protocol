using OHPP.Domain.Shared;

namespace OHPP.Domain.Participation;

public interface IParticipationRecordRepository
{
    Task<ParticipationRecord?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<PagedResult<ParticipationRecord>> GetByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<ParticipationRecord> CreateAsync(ParticipationRecord record, CancellationToken cancellationToken = default);
}
