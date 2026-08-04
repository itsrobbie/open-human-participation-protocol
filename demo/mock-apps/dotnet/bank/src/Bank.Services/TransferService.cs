using Bank.Domain;

namespace Bank.Services;

/// <summary>
/// Handles transfer logic. If the user has OHPP registered, sends a participation
/// request before executing the transfer. If not, proceeds directly.
/// </summary>
public sealed class TransferService
{
    private readonly IAccountStore _accountStore;
    private readonly IParticipationClient _participationClient;
    private readonly ITransactionStore _transactionStore;
    private readonly IClock _clock;

    public TransferService(
        IAccountStore accountStore,
        IParticipationClient participationClient,
        ITransactionStore transactionStore,
        IClock clock)
    {
        _accountStore = accountStore;
        _participationClient = participationClient;
        _transactionStore = transactionStore;
        _clock = clock;
    }

    public async Task<TransferResult> InitiateTransferAsync(TransferRequest request, CancellationToken cancellationToken = default)
    {
        var account = await _accountStore.GetByIdAsync(request.FromAccountId, cancellationToken);
        if (account is null)
            return TransferResult.Failed("Account not found");

        if (request.Amount <= 0)
            return TransferResult.Failed("Amount must be greater than zero");

        if (account.Balance < request.Amount)
            return TransferResult.Failed("Insufficient funds");

        var payee = account.Payees.FirstOrDefault(p => p.Id == request.ToPayeeId);
        if (payee is null)
            return TransferResult.Failed("Payee not found");

        var isFutureSchedule = request.ScheduledFor is { } scheduledFor && scheduledFor > _clock.UtcNow;

        // If user has OHPP registered, request participation before executing
        if (account.OhppRegistration is not null)
        {
            var requestId = await _participationClient.RequestParticipationAsync(
                account.OhppRegistration,
                $"Transfer £{request.Amount:F2} to {payee.Name}",
                $"Transfer **£{request.Amount:F2}** to **{payee.Name}** ({payee.SortCode} / {payee.AccountNumber})",
                request.Amount,
                payee.Name,
                cancellationToken);

            if (requestId is null)
                return TransferResult.Failed("Could not send participation request to Resolver");

            // Record the pending transaction
            await _transactionStore.RecordAsync(new TransactionRecord
            {
                Id = Guid.NewGuid().ToString(),
                AccountId = request.FromAccountId,
                PayeeName = payee.Name,
                Amount = request.Amount,
                Reference = request.Reference,
                Status = TransferStatus.PendingApproval,
                ParticipationRequestId = requestId,
                CreatedAt = _clock.UtcNow,
                ScheduledFor = request.ScheduledFor,
            }, cancellationToken);

            return TransferResult.PendingApproval(requestId);
        }

        if (isFutureSchedule)
        {
            await _transactionStore.RecordAsync(new TransactionRecord
            {
                Id = Guid.NewGuid().ToString(),
                AccountId = request.FromAccountId,
                PayeeName = payee.Name,
                Amount = request.Amount,
                Reference = request.Reference,
                Status = TransferStatus.Scheduled,
                CreatedAt = _clock.UtcNow,
                ScheduledFor = request.ScheduledFor,
            }, cancellationToken);
            return TransferResult.Scheduled();
        }

        // No OHPP and no future schedule: execute directly.
        account.Balance -= request.Amount;
        await _accountStore.SaveAsync(account, cancellationToken);

        // Record the immediate completion
        await _transactionStore.RecordAsync(new TransactionRecord
        {
            Id = Guid.NewGuid().ToString(),
            AccountId = request.FromAccountId,
            PayeeName = payee.Name,
            Amount = request.Amount,
            Reference = request.Reference,
            Status = TransferStatus.Completed,
            ParticipationRequestId = null,
            CreatedAt = _clock.UtcNow,
            ResolvedAt = _clock.UtcNow,
            ScheduledFor = request.ScheduledFor,
        }, cancellationToken);

        return TransferResult.Completed();
    }

    public async Task<TransferResult> CompleteTransferAsync(
        string accountId, string requestId, CancellationToken cancellationToken = default)
    {
        var account = await _accountStore.GetByIdAsync(accountId, cancellationToken);
        if (account is null)
            return TransferResult.Failed("Account not found");

        if (account.OhppRegistration is null)
            return TransferResult.Failed("No OHPP registration");

        var status = await _participationClient.CheckStatusAsync(account.OhppRegistration, requestId, cancellationToken);

        // Update the transaction record when we get a terminal status
        if (status is TransferStatus.Completed or TransferStatus.Denied or TransferStatus.Expired)
        {
            var txn = await _transactionStore.GetByParticipationRequestIdAsync(requestId, cancellationToken);
            if (txn is null || !string.Equals(txn.AccountId, accountId, StringComparison.Ordinal))
                return TransferResult.Failed("Participation request does not belong to this account");
            if (txn.Status == TransferStatus.PendingApproval)
            {
                var resolutionStatus = status == TransferStatus.Completed &&
                    txn.ScheduledFor is { } scheduledFor && scheduledFor > _clock.UtcNow
                    ? TransferStatus.Scheduled
                    : status;
                await _transactionStore.TryResolveAsync(txn.Id, resolutionStatus, _clock.UtcNow, cancellationToken);
                if (resolutionStatus == TransferStatus.Scheduled)
                    return TransferResult.Scheduled();
            }
        }

        return status switch
        {
            TransferStatus.Completed => TransferResult.Completed(),
            TransferStatus.PendingApproval => TransferResult.PendingApproval(requestId),
            TransferStatus.Denied => TransferResult.Denied("User denied the transfer"),
            TransferStatus.Expired => TransferResult.Failed("Participation request expired"),
            TransferStatus.Scheduled => TransferResult.Scheduled(),
            _ => TransferResult.Failed("Unexpected status")
        };
    }
}
