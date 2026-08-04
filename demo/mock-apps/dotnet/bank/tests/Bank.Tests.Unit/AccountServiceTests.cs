using Bank.Domain;
using Bank.Services;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class AccountServiceTests
{
    private readonly IAccountStore _store = Substitute.For<IAccountStore>();

    [Theory]
    [InlineData("", "12-34-56", "12345678")]
    [InlineData("New payee", "123456", "12345678")]
    [InlineData("New payee", "12-34-56", "1234")]
    [InlineData("New payee", "12-34-5X", "12345678")]
    [InlineData("New payee", "12-34-56", "1234567X")]
    public async Task AddPayee_InvalidDetails_DoesNotPersist(
        string name,
        string sortCode,
        string accountNumber)
    {
        var account = Account();
        _store.GetByIdAsync(account.Id, Arg.Any<CancellationToken>()).Returns(account);
        var service = new AccountService(_store);

        var result = await service.AddPayeeAsync(new AddPayeeRequest
        {
            AccountId = account.Id,
            Name = name,
            SortCode = sortCode,
            AccountNumber = accountNumber
        });

        result.Should().BeFalse();
        await _store.DidNotReceive().SaveAsync(Arg.Any<Account>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddPayee_ValidDetails_PersistsPayee()
    {
        var account = Account();
        _store.GetByIdAsync(account.Id, Arg.Any<CancellationToken>()).Returns(account);
        var service = new AccountService(_store);

        var result = await service.AddPayeeAsync(new AddPayeeRequest
        {
            AccountId = account.Id,
            Name = "  New payee  ",
            SortCode = "12-34-56",
            AccountNumber = "12345678"
        });

        result.Should().BeTrue();
        account.Payees.Should().ContainSingle(payee => payee.Name == "New payee");
        await _store.Received(1).SaveAsync(account, Arg.Any<CancellationToken>());
    }

    private static Account Account() => new()
    {
        Id = "account-1",
        OwnerUserId = "user-1",
        Name = "Current account",
        Balance = 100m
    };
}
