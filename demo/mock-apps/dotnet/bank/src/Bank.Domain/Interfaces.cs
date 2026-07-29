namespace Bank.Domain;

public interface IAccountStore
{
    Task<Account?> GetByIdAsync(string accountId, CancellationToken cancellationToken = default);
    Task SaveAsync(Account account, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Account>> GetAllAsync(CancellationToken cancellationToken = default);
}

public interface IParticipationClient
{
    /// <summary>
    /// Sends a participation request to the user's Resolver. Returns the request ID.
    /// </summary>
    Task<string?> RequestParticipationAsync(
        OhppRegistration registration,
        string summary,
        string description,
        decimal amount,
        string payeeName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks the status of a participation request.
    /// </summary>
    Task<TransferStatus> CheckStatusAsync(
        OhppRegistration registration,
        string requestId,
        CancellationToken cancellationToken = default);
}


public interface ITransactionStore
{
    Task RecordAsync(TransactionRecord record, CancellationToken cancellationToken = default);
    Task UpdateStatusAsync(string id, TransferStatus status, CancellationToken cancellationToken = default);
    Task<TransactionRecord?> GetByParticipationRequestIdAsync(string requestId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TransactionRecord>> GetByAccountIdAsync(string accountId, CancellationToken cancellationToken = default);
}
