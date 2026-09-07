using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Services.Participation;
using Xunit;

namespace OHPP.Tests.Unit.Participation;

public class NotificationServiceTests
{
    private readonly INotificationChannel _channel = Substitute.For<INotificationChannel>();
    private readonly IDeviceTokenRepository _deviceRepo = Substitute.For<IDeviceTokenRepository>();
    private readonly IPushNotificationSender _pushSender = Substitute.For<IPushNotificationSender>();
    private readonly NotificationService _sut;

    private readonly Guid _userId = Guid.NewGuid();

    public NotificationServiceTests()
    {
        _pushSender.SendToUserDevicesAsync(
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<PushPayload>(),
                Arg.Any<CancellationToken>())
            .Returns(Array.Empty<string>());

        _sut = new NotificationService(_channel, _deviceRepo, _pushSender);
    }

    private PendingRequest CreatePendingRequest() => new()
    {
        Id = Guid.NewGuid(),
        AppRegistrationId = Guid.NewGuid(),
        UserId = _userId,
        Status = "Pending",
        RequestPayload = "{}",
        AppId = "bank.test",
        ActionSummary = "Approve transfer of $100",
        Type = "Select",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private Device CreateDevice(string? pushToken = "fcm_token_123") => new()
    {
        Id = Guid.NewGuid(),
        UserId = _userId,
        Name = "Test Phone",
        DeviceType = "ios",
        DeviceToken = "ohpp_dev_test",
        PushToken = pushToken,
        IsActive = true,
        RegisteredAt = DateTimeOffset.UtcNow,
    };

    // --- Happy path ---

    [Fact]
    public async Task NotifyNewRequest_SendsSseToChannel()
    {
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device>());

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _channel.Received(1).NotifyDevicesAsync(
            _userId, "new_request", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NotifyNewRequest_SsePayload_IsCamelCase_MatchingHttpContract()
    {
        // The SSE new_request payload MUST use the same camelCase field names as
        // the GET /api/devices/me/pending response, or the mobile client parses
        // nulls and shows a blank request card. Raw System.Text.Json defaults to
        // PascalCase, so the payload must be serialized with camelCase.
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device>());

        string? capturedPayload = null;
        await _channel.NotifyDevicesAsync(
            Arg.Any<Guid>(), "new_request", Arg.Do<string>(p => capturedPayload = p),
            Arg.Any<CancellationToken>());

        await _sut.NotifyNewRequestAsync(_userId, request);

        Assert.NotNull(capturedPayload);
        // camelCase keys the Flutter ParticipationRequest.fromJson reads:
        Assert.Contains("\"requestId\"", capturedPayload);
        Assert.Contains("\"appId\"", capturedPayload);
        Assert.Contains("\"summary\"", capturedPayload);
        Assert.Contains("Approve transfer of $100", capturedPayload);
        // Must NOT be PascalCase:
        Assert.DoesNotContain("\"RequestId\"", capturedPayload);
        Assert.DoesNotContain("\"Summary\"", capturedPayload);
    }

    [Fact]
    public async Task DispatchPush_NewRequest_SendsToAllDeviceTokens()
    {
        var request = CreatePendingRequest();
        var devices = new List<Device>
        {
            CreateDevice("token_1"),
            CreateDevice("token_2"),
        };
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(devices);

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _pushSender.Received(1).SendToUserDevicesAsync(
            Arg.Is<IReadOnlyList<string>>(t => t.Count == 2 && t.Contains("token_1") && t.Contains("token_2")),
            Arg.Any<PushPayload>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchPush_MultipleDevices_SendsToEach()
    {
        var request = CreatePendingRequest();
        var devices = new List<Device>
        {
            CreateDevice("token_a"),
            CreateDevice("token_b"),
            CreateDevice("token_c"),
        };
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(devices);

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _pushSender.Received(1).SendToUserDevicesAsync(
            Arg.Is<IReadOnlyList<string>>(t => t.Count == 3),
            Arg.Any<PushPayload>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchPush_PayloadContainsRequestIdAppIdSummary()
    {
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice() });

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _pushSender.Received(1).SendToUserDevicesAsync(
            Arg.Any<IReadOnlyList<string>>(),
            Arg.Is<PushPayload>(p =>
                p.RequestId == request.Id &&
                p.AppId == "bank.test" &&
                p.Summary == "Approve transfer of $100"),
            Arg.Any<CancellationToken>());
    }

    // --- Non-happy path ---

    [Fact]
    public async Task DispatchPush_InvalidToken_RemovesFromDB()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice("bad_token");
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { device });
        _pushSender.SendToUserDevicesAsync(
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<PushPayload>(),
                Arg.Any<CancellationToken>())
            .Returns(new List<string> { "bad_token" });

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _deviceRepo.Received(1).UpdateAsync(
            Arg.Is<Device>(d => d.PushToken == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchPush_NoTokens_NoErrorNoSend()
    {
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice(null) });

        await _sut.NotifyNewRequestAsync(_userId, request);

        await _pushSender.DidNotReceive().SendToUserDevicesAsync(
            Arg.Any<IReadOnlyList<string>>(),
            Arg.Any<PushPayload>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchPush_PartialFailure_RemovesFailedTokensOnly()
    {
        var request = CreatePendingRequest();
        var goodDevice = CreateDevice("good_token");
        var badDevice = CreateDevice("bad_token");
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { goodDevice, badDevice });
        _pushSender.SendToUserDevicesAsync(
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<PushPayload>(),
                Arg.Any<CancellationToken>())
            .Returns(new List<string> { "bad_token" });

        await _sut.NotifyNewRequestAsync(_userId, request);

        // Only the bad token device should be updated
        await _deviceRepo.Received(1).UpdateAsync(
            Arg.Is<Device>(d => d.PushToken == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task pushDispatcher_devNoop_doesNotSend()
    {
        // The dev/default dispatcher is a real no-op (not a null dependency): it
        // never sends and reports no failed tokens, while SSE is still delivered.
        // (This mirrors the real NoOpPushNotificationSender in Infrastructure.DotNet;
        // its live registration is covered by the DI resolution integration test.)
        var noOpSender = new NoOpFake();
        var sut = new NotificationService(_channel, _deviceRepo, noOpSender);
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice() });

        await sut.NotifyNewRequestAsync(_userId, request);

        // SSE always delivered; the no-op dispatcher was invoked but sent nothing.
        await _channel.Received(1).NotifyDevicesAsync(
            _userId, "new_request", Arg.Any<string>(), Arg.Any<CancellationToken>());
        noOpSender.Calls.Should().Be(1);
        noOpSender.TotalTokensSeen.Should().Be(1);
    }

    /// <summary>
    /// Local stand-in for NoOpPushNotificationSender: sends nothing, returns no
    /// failed tokens. Defined here so the unit-test project need not reference the
    /// infrastructure layer; the real no-op's DI registration is asserted by the
    /// integration DiResolutionTests.
    /// </summary>
    private sealed class NoOpFake : IPushNotificationSender
    {
        public int Calls { get; private set; }
        public int TotalTokensSeen { get; private set; }

        public Task<IReadOnlyList<string>> SendToUserDevicesAsync(
            IReadOnlyList<string> pushTokens,
            PushPayload payload,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            TotalTokensSeen += pushTokens.Count;
            return Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());
        }
    }

    [Fact]
    public async Task DispatchPush_FirebaseUnavailable_LogsErrorNoThrow()
    {
        var request = CreatePendingRequest();
        _deviceRepo.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice("valid_token") });
        _pushSender.SendToUserDevicesAsync(
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<PushPayload>(),
                Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<string>>(_ => throw new InvalidOperationException("Firebase app not initialized"));

        // Should not throw - push is best-effort
        var act = () => _sut.NotifyNewRequestAsync(_userId, request);
        await act.Should().NotThrowAsync();

        // SSE should still have been sent (happens before push)
        await _channel.Received(1).NotifyDevicesAsync(
            _userId, "new_request", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
