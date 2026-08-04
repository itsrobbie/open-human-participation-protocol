using System.Collections.Concurrent;
using Bank.Domain;

namespace Bank.Infrastructure;

public sealed class InMemoryTransactionStore : ITransactionStore
{
    private readonly ConcurrentDictionary<string, TransactionRecord> _records = new();

    public Task RecordAsync(TransactionRecord record, CancellationToken cancellationToken = default)
    {
        _records[record.Id] = record;
        return Task.CompletedTask;
    }

    public Task<bool> TryResolveAsync(
        string id,
        TransferStatus status,
        DateTimeOffset resolvedAt,
        CancellationToken cancellationToken = default)
    {
        if (_records.TryGetValue(id, out var record))
        {
            lock (record)
            {
                if (record.Status != TransferStatus.PendingApproval)
                    return Task.FromResult(false);
                record.Status = status;
                record.ResolvedAt = resolvedAt;
            }
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task<TransactionRecord?> GetByParticipationRequestIdAsync(string requestId, CancellationToken cancellationToken = default)
    {
        var record = _records.Values.FirstOrDefault(r => r.ParticipationRequestId == requestId);
        return Task.FromResult(record);
    }

    public Task<IReadOnlyList<TransactionRecord>> GetByAccountIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        var records = _records.Values
            .Where(r => r.AccountId == accountId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<TransactionRecord>>(records);
    }

    public Task<int> ExecuteDueScheduledAsync(
        string accountId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var completed = 0;
        foreach (var record in _records.Values.Where(record =>
                     record.AccountId == accountId &&
                     record.Status == TransferStatus.Scheduled &&
                     record.ScheduledFor <= now))
        {
            lock (record)
            {
                if (record.Status != TransferStatus.Scheduled) continue;
                record.Status = TransferStatus.Completed;
                record.ResolvedAt = now;
                completed++;
            }
        }
        return Task.FromResult(completed);
    }
}
