using Bank.Domain;
using System.Text.RegularExpressions;

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

    public Task SaveAccountAsync(Account account, CancellationToken cancellationToken = default)
    {
        return _accountStore.SaveAsync(account, cancellationToken);
    }

    public async Task<bool> AddPayeeAsync(AddPayeeRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 120 ||
            !Regex.IsMatch(request.SortCode ?? string.Empty, "^[0-9]{2}-[0-9]{2}-[0-9]{2}$") ||
            !Regex.IsMatch(request.AccountNumber ?? string.Empty, "^[0-9]{8}$"))
            return false;

        var account = await _accountStore.GetByIdAsync(request.AccountId, cancellationToken);
        if (account is null)
            return false;

        account.Payees.Add(new Payee
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = request.Name.Trim(),
            AccountNumber = request.AccountNumber!,
            SortCode = request.SortCode!
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
