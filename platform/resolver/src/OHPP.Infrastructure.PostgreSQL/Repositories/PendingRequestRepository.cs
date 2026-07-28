using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class PendingRequestRepository : IPendingRequestRepository
{
    private readonly AppDbContext _db;

    public PendingRequestRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PendingRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.PendingRequests.FindAsync(new object[] { id }, cancellationToken);
    }

    public async Task<PendingRequest?> GetByIdForAppAsync(Guid id, Guid appRegistrationId, CancellationToken cancellationToken = default)
    {
        return await _db.PendingRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.AppRegistrationId == appRegistrationId, cancellationToken);
    }

    public async Task<IReadOnlyList<PendingRequest>> GetPendingByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.PendingRequests
            .Where(r => r.UserId == userId && r.Status == "Pending")
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PendingRequest>> GetExpiredPendingAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        return await _db.PendingRequests
            .Where(r => r.Status == "Pending" && r.ExpiresAt != null && r.ExpiresAt < now)
            .ToListAsync(cancellationToken);
    }

    public async Task<PendingRequest> CreateAsync(PendingRequest request, CancellationToken cancellationToken = default)
    {
        _db.PendingRequests.Add(request);
        await _db.SaveChangesAsync(cancellationToken);
        return request;
    }

    public async Task UpdateStatusAsync(Guid id, string status, DateTimeOffset? resolvedAt, CancellationToken cancellationToken = default)
    {
        var request = await _db.PendingRequests.FindAsync(new object[] { id }, cancellationToken);
        if (request is not null)
        {
            request.Status = status;
            request.ResolvedAt = resolvedAt;
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task CancelAllForAppRegistrationAsync(Guid appRegistrationId, CancellationToken cancellationToken = default)
    {
        var pending = await _db.PendingRequests
            .Where(r => r.AppRegistrationId == appRegistrationId && r.Status == "Pending")
            .ToListAsync(cancellationToken);

        foreach (var request in pending)
        {
            request.Status = "Cancelled";
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> CountPendingByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.PendingRequests
            .CountAsync(r => r.UserId == userId && r.Status == "Pending", cancellationToken);
    }
}
