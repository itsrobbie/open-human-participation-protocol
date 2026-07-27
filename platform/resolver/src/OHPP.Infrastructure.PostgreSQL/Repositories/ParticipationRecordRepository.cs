using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class ParticipationRecordRepository : IParticipationRecordRepository
{
    private readonly AppDbContext _db;

    public ParticipationRecordRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ParticipationRecord?> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        return await _db.ParticipationRecords
            .FirstOrDefaultAsync(r => r.RequestId == requestId, cancellationToken);
    }

    public async Task<PagedResult<ParticipationRecord>> GetByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _db.ParticipationRecords
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ParticipationRecord>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<ParticipationRecord> CreateAsync(ParticipationRecord record, CancellationToken cancellationToken = default)
    {
        _db.ParticipationRecords.Add(record);
        await _db.SaveChangesAsync(cancellationToken);
        return record;
    }
}
