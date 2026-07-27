using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Services.Participation;
using Xunit;

namespace OHPP.Tests.Unit.Participation;

public class ExpiryEnforcementServiceTests
{
    private readonly IPendingRequestRepository _pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
    private readonly IParticipationRecordRepository _recordRepo = Substitute.For<IParticipationRecordRepository>();
    private readonly INotificationChannel _channel = Substitute.For<INotificationChannel>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly ExpiryEnforcementService _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);

    public ExpiryEnforcementServiceTests()
    {
        _clock.UtcNow.Returns(Now);
        _recordRepo.CreateAsync(Arg.Any<ParticipationRecord>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<ParticipationRecord>());

        _sut = new ExpiryEnforcementService(_pendingRequestRepo, _recordRepo, _channel, _clock);
    }

    [Fact]
    public async Task ExpiryCheck_ExpiredRequests_MarksExpired()
    {
        var expired1 = CreatePendingRequest(Now.AddMinutes(-5));
        var expired2 = CreatePendingRequest(Now.AddMinutes(-10));
        _pendingRequestRepo.GetExpiredPendingAsync(Now, Arg.Any<CancellationToken>())
            .Returns(new List<PendingRequest> { expired1, expired2 });

        var count = await _sut.EnforceExpiredRequestsAsync();

        count.Should().Be(2);
        await _pendingRequestRepo.Received(1).UpdateStatusAsync(expired1.Id, "Expired", Now, Arg.Any<CancellationToken>());
        await _pendingRequestRepo.Received(1).UpdateStatusAsync(expired2.Id, "Expired", Now, Arg.Any<CancellationToken>());
        await _recordRepo.Received(2).CreateAsync(
            Arg.Is<ParticipationRecord>(r => r.Status == "Expired"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExpiryCheck_NotExpired_NoChange()
    {
        _pendingRequestRepo.GetExpiredPendingAsync(Now, Arg.Any<CancellationToken>())
            .Returns(new List<PendingRequest>());

        var count = await _sut.EnforceExpiredRequestsAsync();

        count.Should().Be(0);
        await _pendingRequestRepo.DidNotReceive().UpdateStatusAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExpiryCheck_AlreadyExpired_Idempotent()
    {
        // The repo only returns Pending requests that have expired — so if we run again, nothing happens
        _pendingRequestRepo.GetExpiredPendingAsync(Now, Arg.Any<CancellationToken>())
            .Returns(new List<PendingRequest>());

        var count = await _sut.EnforceExpiredRequestsAsync();

        count.Should().Be(0);
    }

    [Fact]
    public void ExpiryCheck_NullExpiry_NeverExpires()
    {
        var request = new PendingRequest
        {
            Id = Guid.NewGuid(),
            AppRegistrationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Status = "Pending",
            RequestPayload = "{}",
            AppId = "bank.test",
            ActionSummary = "Approve",
            Type = "Select",
            CreatedAt = Now.AddMinutes(-60),
            ExpiresAt = null,
            ResolvedAt = null
        };

        var expired = _sut.CheckAndExpireIfNeeded(request);

        expired.Should().BeFalse();
    }

    private static PendingRequest CreatePendingRequest(DateTimeOffset expiresAt) => new()
    {
        Id = Guid.NewGuid(),
        AppRegistrationId = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        Status = "Pending",
        RequestPayload = "{}",
        AppId = "bank.test",
        ActionSummary = "Test action",
        Type = "Select",
        CreatedAt = expiresAt.AddMinutes(-30),
        ExpiresAt = expiresAt,
        ResolvedAt = null
    };
}
