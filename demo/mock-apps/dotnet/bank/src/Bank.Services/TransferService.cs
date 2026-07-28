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

    public TransferService(IAccountStore accountStore, IParticipationClient participationClient)
    {
        _accountStore = accountStore;
        _participationClient = participationClient;
    }

    public async Task<TransferResult> InitiateTransferAsync(TransferRequest request, CancellationToken cancellationToken = default)
    {
        var account = await _accountStore.GetByIdAsync(request.FromAccountId, cancellationToken);
        if (account is null)
            return TransferResult.Failed("Account not found");

        if (account.Balance < request.Amount)
            return TransferResult.Failed("Insufficient funds");

        var payee = account.Payees.FirstOrDefault(p => p.Id == request.ToPayeeId);
        if (payee is null)
            return TransferResult.Failed("Payee not found");

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

            return TransferResult.PendingApproval(requestId);
        }

        // No OHPP — execute directly
        account.Balance -= request.Amount;
        await _accountStore.SaveAsync(account, cancellationToken);
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

        return status switch
        {
            TransferStatus.Completed => TransferResult.Completed(),
            TransferStatus.PendingApproval => TransferResult.PendingApproval(requestId),
            TransferStatus.Denied => TransferResult.Denied("User denied the transfer"),
            TransferStatus.Expired => TransferResult.Failed("Participation request expired"),
            _ => TransferResult.Failed("Unexpected status")
        };
    }
}
