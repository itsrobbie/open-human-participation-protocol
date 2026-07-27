using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Services.Participation;
using Xunit;

namespace OHPP.Tests.Unit.Participation;

public class RequestLifecycleManagerTests
{
    private readonly IPendingRequestRepository _pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
    private readonly IParticipationRecordRepository _recordRepo = Substitute.For<IParticipationRecordRepository>();
    private readonly IExpiryEnforcementService _expiryService = Substitute.For<IExpiryEnforcementService>();
    private readonly INotificationChannel _channel = Substitute.For<INotificationChannel>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly RequestLifecycleManager _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
    private readonly Guid _appRegistrationId = Guid.NewGuid();

    public RequestLifecycleManagerTests()
    {
        _clock.UtcNow.Returns(Now);
        _expiryService.CheckAndExpireIfNeeded(Arg.Any<PendingRequest>()).Returns(false);
        _recordRepo.CreateAsync(Arg.Any<ParticipationRecord>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<ParticipationRecord>());

        _sut = new RequestLifecycleManager(
            _pendingRequestRepo, _recordRepo, _expiryService, _channel, _clock);
    }

    [Fact]
    public async Task GetStatus_PendingRequest_ReturnsPending()
    {
        var request = CreateRequest("Pending");
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.GetStatusAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task GetStatus_ResolvedRequest_ReturnsAttestation()
    {
        var request = CreateRequest("Resolved", resolvedAt: Now.AddMinutes(-5));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.GetStatusAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Resolved");
        result.Value.ResolvedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetStatus_ExpiredRequest_ReturnsExpired()
    {
        var request = CreateRequest("Expired", resolvedAt: Now.AddMinutes(-1));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.GetStatusAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Expired");
    }

    [Fact]
    public async Task GetStatus_CancelledRequest_ReturnsCancelled()
    {
        var request = CreateRequest("Cancelled", resolvedAt: Now.AddMinutes(-2));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.GetStatusAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Cancelled");
    }

    [Fact]
    public async Task GetStatus_WrongApp_ReturnsNotFound()
    {
        var wrongAppId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        _pendingRequestRepo.GetByIdForAppAsync(requestId, wrongAppId, Arg.Any<CancellationToken>())
            .Returns((PendingRequest?)null);

        var result = await _sut.GetStatusAsync(requestId, wrongAppId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetStatus_PendingButExpired_LazilyMarksExpired_ReturnsExpired()
    {
        var request = CreateRequest("Pending", expiresAt: Now.AddMinutes(-1));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);
        _expiryService.CheckAndExpireIfNeeded(request).Returns(true);

        var result = await _sut.GetStatusAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Expired");
        await _pendingRequestRepo.Received(1).UpdateStatusAsync(request.Id, "Expired", Now, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CancelRequest_Pending_CancelsAndNotifies()
    {
        var request = CreateRequest("Pending");
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.CancelRequestAsync(request.Id, _appRegistrationId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
        await _pendingRequestRepo.Received(1).UpdateStatusAsync(request.Id, "Cancelled", Now, Arg.Any<CancellationToken>());
        await _recordRepo.Received(1).CreateAsync(
            Arg.Is<ParticipationRecord>(r => r.Status == "Cancelled" && r.RequestId == request.Id),
            Arg.Any<CancellationToken>());
        await _channel.Received(1).NotifyDevicesAsync(request.UserId, "request_cancelled", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CancelRequest_AlreadyResolved_ReturnsConflict()
    {
        var request = CreateRequest("Resolved", resolvedAt: Now.AddMinutes(-5));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.CancelRequestAsync(request.Id, _appRegistrationId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task CancelRequest_AlreadyExpired_ReturnsConflict()
    {
        var request = CreateRequest("Expired", resolvedAt: Now.AddMinutes(-1));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.CancelRequestAsync(request.Id, _appRegistrationId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task CancelRequest_AlreadyCancelled_ReturnsConflict()
    {
        var request = CreateRequest("Cancelled", resolvedAt: Now.AddMinutes(-2));
        _pendingRequestRepo.GetByIdForAppAsync(request.Id, _appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(request);

        var result = await _sut.CancelRequestAsync(request.Id, _appRegistrationId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task CancelRequest_WrongApp_ReturnsNotFound()
    {
        var wrongAppId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        _pendingRequestRepo.GetByIdForAppAsync(requestId, wrongAppId, Arg.Any<CancellationToken>())
            .Returns((PendingRequest?)null);

        var result = await _sut.CancelRequestAsync(requestId, wrongAppId);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("NOT_FOUND");
    }

    private PendingRequest CreateRequest(string status, DateTimeOffset? expiresAt = null, DateTimeOffset? resolvedAt = null) => new()
    {
        Id = Guid.NewGuid(),
        AppRegistrationId = _appRegistrationId,
        UserId = Guid.NewGuid(),
        Status = status,
        RequestPayload = "{}",
        AppId = "bank.test",
        ActionSummary = "Approve payment",
        Type = "Select",
        CreatedAt = Now.AddMinutes(-10),
        ExpiresAt = expiresAt ?? Now.AddMinutes(30),
        ResolvedAt = resolvedAt
    };
}
