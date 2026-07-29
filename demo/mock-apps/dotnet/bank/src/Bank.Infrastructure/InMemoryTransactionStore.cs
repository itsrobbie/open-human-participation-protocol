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

    public Task UpdateStatusAsync(string id, TransferStatus status, CancellationToken cancellationToken = default)
    {
        if (_records.TryGetValue(id, out var record))
        {
            record.Status = status;
            record.ResolvedAt = DateTimeOffset.UtcNow;
        }
        return Task.CompletedTask;
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
}
