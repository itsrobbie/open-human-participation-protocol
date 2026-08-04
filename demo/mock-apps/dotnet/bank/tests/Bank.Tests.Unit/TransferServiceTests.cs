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
    private readonly ITransactionStore _transactionStore = Substitute.For<ITransactionStore>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly TransferService _service;

    public TransferServiceTests()
    {
        _clock.UtcNow.Returns(new DateTimeOffset(2026, 7, 31, 12, 0, 0, TimeSpan.Zero));
        _service = new TransferService(_accountStore, _participationClient, _transactionStore, _clock);
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
        await _transactionStore.Received(1).RecordAsync(
            Arg.Is<TransactionRecord>(record =>
                record.CreatedAt == _clock.UtcNow &&
                record.ResolvedAt == _clock.UtcNow),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TransferService_FutureScheduledTransfer_DoesNotDeductAndRecordsSchedule()
    {
        var account = CreateAccount(withOhpp: false);
        var scheduledFor = _clock.UtcNow.AddDays(1);
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);

        var result = await _service.InitiateTransferAsync(new TransferRequest
        {
            FromAccountId = "acc-1",
            ToPayeeId = "payee-1",
            Amount = 100m,
            ScheduledFor = scheduledFor
        });

        result.Status.Should().Be(TransferStatus.Scheduled);
        account.Balance.Should().Be(1000m);
        await _accountStore.DidNotReceive().SaveAsync(account, Arg.Any<CancellationToken>());
        await _transactionStore.Received(1).RecordAsync(
            Arg.Is<TransactionRecord>(record =>
                record.Status == TransferStatus.Scheduled &&
                record.ScheduledFor == scheduledFor &&
                record.ResolvedAt == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TransferService_Approved_ExecutesTransfer()
    {
        var account = CreateAccount(withOhpp: true);
        var transaction = new TransactionRecord
        {
            Id = "txn-1",
            AccountId = account.Id,
            PayeeName = "John",
            Amount = 100m,
            Status = TransferStatus.PendingApproval,
            ParticipationRequestId = "req-123",
            CreatedAt = _clock.UtcNow.AddMinutes(-1)
        };
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _transactionStore.GetByParticipationRequestIdAsync("req-123", Arg.Any<CancellationToken>())
            .Returns(transaction);
        _transactionStore.TryResolveAsync(
                transaction.Id,
                TransferStatus.Completed,
                _clock.UtcNow,
                Arg.Any<CancellationToken>())
            .Returns(true);
        _participationClient.CheckStatusAsync(
            Arg.Any<OhppRegistration>(), "req-123", Arg.Any<CancellationToken>())
            .Returns(TransferStatus.Completed);

        var result = await _service.CompleteTransferAsync("acc-1", "req-123");

        result.Status.Should().Be(TransferStatus.Completed);
        result.Success.Should().BeTrue();
        await _transactionStore.Received(1).TryResolveAsync(
            transaction.Id,
            TransferStatus.Completed,
            _clock.UtcNow,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TransferService_RequestOwnedByAnotherAccount_DoesNotResolveTransaction()
    {
        var account = CreateAccount(withOhpp: true);
        var transaction = new TransactionRecord
        {
            Id = "txn-other",
            AccountId = "other-account",
            PayeeName = "John",
            Amount = 100m,
            Status = TransferStatus.PendingApproval,
            ParticipationRequestId = "req-other",
            CreatedAt = _clock.UtcNow.AddMinutes(-1)
        };
        _accountStore.GetByIdAsync(account.Id, Arg.Any<CancellationToken>()).Returns(account);
        _transactionStore.GetByParticipationRequestIdAsync("req-other", Arg.Any<CancellationToken>()).Returns(transaction);
        _participationClient.CheckStatusAsync(Arg.Any<OhppRegistration>(), "req-other", Arg.Any<CancellationToken>())
            .Returns(TransferStatus.Completed);

        var result = await _service.CompleteTransferAsync(account.Id, "req-other");

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("belong");
        await _transactionStore.DidNotReceive().TryResolveAsync(
            Arg.Any<string>(),
            Arg.Any<TransferStatus>(),
            Arg.Any<DateTimeOffset>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TransferService_Denied_RejectsTransfer()
    {
        var account = CreateAccount(withOhpp: true);
        var transaction = PendingTransaction(account.Id, "req-456");
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _transactionStore.GetByParticipationRequestIdAsync("req-456", Arg.Any<CancellationToken>()).Returns(transaction);
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
        var transaction = PendingTransaction(account.Id, "req-789");
        _accountStore.GetByIdAsync("acc-1", Arg.Any<CancellationToken>()).Returns(account);
        _transactionStore.GetByParticipationRequestIdAsync("req-789", Arg.Any<CancellationToken>()).Returns(transaction);
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

    private TransactionRecord PendingTransaction(string accountId, string requestId) => new()
    {
        Id = $"txn-{requestId}",
        AccountId = accountId,
        PayeeName = "John",
        Amount = 100m,
        Status = TransferStatus.PendingApproval,
        ParticipationRequestId = requestId,
        CreatedAt = _clock.UtcNow.AddMinutes(-1)
    };
}
