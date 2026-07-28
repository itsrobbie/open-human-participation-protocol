using Bank.Domain;

namespace Bank.Services;

/// <summary>
/// Manages accounts, payees, and OHPP registration.
/// </summary>
public sealed class AccountService
{
    private readonly IAccountStore _accountStore;

    public AccountService(IAccountStore accountStore)
    {
        _accountStore = accountStore;
    }

    public async Task<Account?> GetAccountAsync(string accountId, CancellationToken cancellationToken = default)
    {
        return await _accountStore.GetByIdAsync(accountId, cancellationToken);
    }

    public async Task<IReadOnlyList<Account>> GetAllAccountsAsync(CancellationToken cancellationToken = default)
    {
        return await _accountStore.GetAllAsync(cancellationToken);
    }

    public async Task<bool> AddPayeeAsync(AddPayeeRequest request, CancellationToken cancellationToken = default)
    {
        var account = await _accountStore.GetByIdAsync(request.AccountId, cancellationToken);
        if (account is null)
            return false;

        account.Payees.Add(new Payee
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = request.Name,
            AccountNumber = request.AccountNumber,
            SortCode = request.SortCode
        });

        await _accountStore.SaveAsync(account, cancellationToken);
        return true;
    }

    public async Task<bool> RegisterOhppAsync(string accountId, OhppRegistration registration, CancellationToken cancellationToken = default)
    {
        var account = await _accountStore.GetByIdAsync(accountId, cancellationToken);
        if (account is null)
            return false;

        account.OhppRegistration = registration;
        await _accountStore.SaveAsync(account, cancellationToken);
        return true;
    }
}
