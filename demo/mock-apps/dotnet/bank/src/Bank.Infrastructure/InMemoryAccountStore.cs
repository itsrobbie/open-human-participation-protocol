using System.Collections.Concurrent;
using Bank.Domain;

namespace Bank.Infrastructure;

/// <summary>
/// In-memory account store for demo purposes. Pre-seeded with sample accounts.
/// </summary>
public sealed class InMemoryAccountStore : IAccountStore
{
    private readonly ConcurrentDictionary<string, Account> _accounts = new();

    public InMemoryAccountStore()
    {
        // Pre-seed demo data
        var account = new Account
        {
            Id = "demo-account",
            Name = "Demo Savings Account",
            Balance = 5000.00m,
            Payees =
            {
                new Payee { Id = "payee-landlord", Name = "Landlord - J. Smith", AccountNumber = "40205678", SortCode = "20-30-40" },
                new Payee { Id = "payee-electric", Name = "Electric Co.", AccountNumber = "11223344", SortCode = "10-20-30" },
                new Payee { Id = "payee-friend", Name = "Alex (friend)", AccountNumber = "87654321", SortCode = "40-50-60" }
            }
        };
        _accounts[account.Id] = account;
    }

    public Task<Account?> GetByIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        _accounts.TryGetValue(accountId, out var account);
        return Task.FromResult(account);
    }

    public Task SaveAsync(Account account, CancellationToken cancellationToken = default)
    {
        _accounts[account.Id] = account;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Account>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<Account>>(_accounts.Values.ToList());
    }
}
