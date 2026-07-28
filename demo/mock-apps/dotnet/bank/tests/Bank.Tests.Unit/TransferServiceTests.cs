using Bank.Domain;
using Bank.Services;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class TransferServiceTests
{
    private readonly IAccountStore _accountStore = Substitute.For<IAccountStore>();
    private readonly IParticipationClient _participationClient = Substitute.For<IParticipationClient>();
    private readonly TransferService _service;

    public TransferServiceTests()
    {
        _service = new TransferService(_accountStore, _participationClient);
    }

    private static Account CreateAccount(bool withOhpp = false, decimal balance = 1000m)
    {
        var account = new Account
        {
            Id = "acc-1",
            Name = "Test Account",
            Balance = balance,
            Payees = { new Payee { Id = "payee-1", Name = "John", AccountNumber = "12345678", SortCode = "01-02-03" } }
        };

        if (withOhpp)
        {
            account.OhppRegistration = new OhppRegistration
            {
                ResolverUrl = "http://resolver.test",
                AccessToken = "ohpp_app_token",
                UserId = "user-123"
            };
        }

        return account;
    }

    [Fact]
    public async Task TransferService_UserRegistered_SendsParticipationRequest()
    {
        var account = CreateAccount(withOhpp: true);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _participationClient.RequestParticipationAsync(
            Arg.Any<OhppRegistration>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("req-123");

        var result = await _service.InitiateTransferAsync(new TransferRequest
        {
            FromAccountId = "acc-1",
            ToPayeeId = "payee-1",
            Amount = 500m
        });

        result.Status.Should().Be(TransferStatus.PendingApproval);
        result.ParticipationRequestId.Should().Be("req-123");
        await _participationClient.Received(1).RequestParticipationAsync(
            Arg.Any<OhppRegistration>(),
            Arg.Is<string>(s => s.Contains("500")),
            Arg.Any<string>(),
            500m,
            "John",
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TransferService_UserNotRegistered_ProceedsWithout()
    {
        var account = CreateAccount(withOhpp: false);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);

        var result = await _service.InitiateTransferAsync(new TransferRequest
        {
            FromAccountId = "acc-1",
            ToPayeeId = "payee-1",
            Amount = 100m
        });

        result.Status.Should().Be(TransferStatus.Completed);
        result.Success.Should().BeTrue();
        await _participationClient.DidNotReceive().RequestParticipationAsync(
            Arg.Any<OhppRegistration>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<CancellationToken>());

        // Balance should be deducted
        account.Balance.Should().Be(900m);
    }

    [Fact]
    public async Task TransferService_Approved_ExecutesTransfer()
    {
        var account = CreateAccount(withOhpp: true);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _participationClient.CheckStatusAsync(
            Arg.Any<OhppRegistration>(), "req-123", Arg.Any<CancellationToken>())
            .Returns(TransferStatus.Completed);

        var result = await _service.CompleteTransferAsync("acc-1", "req-123");

        result.Status.Should().Be(TransferStatus.Completed);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task TransferService_Denied_RejectsTransfer()
    {
        var account = CreateAccount(withOhpp: true);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _participationClient.CheckStatusAsync(
            Arg.Any<OhppRegistration>(), "req-456", Arg.Any<CancellationToken>())
            .Returns(TransferStatus.Denied);

        var result = await _service.CompleteTransferAsync("acc-1", "req-456");

        result.Status.Should().Be(TransferStatus.Denied);
        result.Success.Should().BeFalse();
        result.Error.Should().Contain("denied");
    }

    [Fact]
    public async Task TransferService_Expired_RejectsTransfer()
    {
        var account = CreateAccount(withOhpp: true);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _participationClient.CheckStatusAsync(
            Arg.Any<OhppRegistration>(), "req-789", Arg.Any<CancellationToken>())
            .Returns(TransferStatus.Expired);

        var result = await _service.CompleteTransferAsync("acc-1", "req-789");

        result.Status.Should().Be(TransferStatus.Failed);
        result.Success.Should().BeFalse();
        result.Error.Should().Contain("expired");
    }

    [Fact]
    public async Task TransferService_InsufficientFunds_RejectsTransfer()
    {
        var account = CreateAccount(withOhpp: false, balance: 50m);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);

        var result = await _service.InitiateTransferAsync(new TransferRequest
        {
            FromAccountId = "acc-1",
            ToPayeeId = "payee-1",
            Amount = 100m
        });

        result.Status.Should().Be(TransferStatus.Failed);
        result.Error.Should().Contain("Insufficient");
    }

    [Fact]
    public async Task TransferService_AccountNotFound_Fails()
    {
        _accountStore.GetByIdAsync("nope", Arg.Any<CancellationToken>()).Returns((Account?)null);

        var result = await _service.InitiateTransferAsync(new TransferRequest
        {
            FromAccountId = "nope",
            ToPayeeId = "payee-1",
            Amount = 100m
        });

        result.Status.Should().Be(TransferStatus.Failed);
        result.Error.Should().Contain("not found");
    }
}
