using Bank.Domain;
using Bank.Infrastructure;
using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using Xunit;

namespace Bank.Tests.Unit;

/// <summary>
/// Tests for OhppParticipationClient resilience.
/// These prove the bank handles SDK/network failures gracefully:
/// - Transient failures during initial request return null (not throw)
/// - Transient failures during status polling return PendingApproval (not Failed)
/// </summary>
public sealed class OhppParticipationClientTests
{
    private readonly IOhppRequesterClient _requesterClient = Substitute.For<IOhppRequesterClient>();
    private readonly OhppParticipationClient _client;
    private readonly OhppRegistration _registration = new()
    {
        ResolverUrl = "http://resolver.test",
        AccessToken = "test-token",
        UserId = "user-1"
    };

    public OhppParticipationClientTests()
    {
        _client = new OhppParticipationClient(_requesterClient, "bank.test");
    }

    // --- RequestParticipationAsync ---

    [Fact]
    public async Task RequestParticipation_SdkThrowsHttpException_ReturnsNull()
    {
        _requesterClient
            .SendRequestAsync(Arg.Any<ParticipationRequest>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Throws(new HttpRequestException("Connection refused"));

        var result = await _client.RequestParticipationAsync(
            _registration, "Transfer £50", "desc", 50m, "John");

        result.Should().BeNull();
    }

    [Fact]
    public async Task RequestParticipation_SdkReturnsFailure_ReturnsNull()
    {
        _requesterClient
            .SendRequestAsync(Arg.Any<ParticipationRequest>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(ParticipationResult.Fail("Resolver error", 500));

        var result = await _client.RequestParticipationAsync(
            _registration, "Transfer £50", "desc", 50m, "John");

        result.Should().BeNull();
    }

    [Fact]
    public async Task RequestParticipation_SdkReturnsSuccess_ReturnsRequestId()
    {
        _requesterClient
            .SendRequestAsync(Arg.Any<ParticipationRequest>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(ParticipationResult.Ok("req-abc"));

        var result = await _client.RequestParticipationAsync(
            _registration, "Transfer £50", "desc", 50m, "John");

        result.Should().Be("req-abc");
    }

    // --- CheckStatusAsync ---

    [Fact]
    public async Task CheckStatus_SdkThrowsHttpException_ReturnsPendingApproval()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Throws(new HttpRequestException("Connection timed out"));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.PendingApproval);
    }

    [Fact]
    public async Task CheckStatus_SdkReturnsFailure_ReturnsPendingApproval()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(RequestStatusResult.Fail("Network error", 500));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.PendingApproval);
    }

    [Fact]
    public async Task CheckStatus_Pending_ReturnsPendingApproval()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(RequestStatusResult.Ok(RequestStatus.Pending, null));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.PendingApproval);
    }

    [Fact]
    public async Task CheckStatus_Resolved_ReturnsCompleted()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(RequestStatusResult.Ok(RequestStatus.Resolved, null));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.Completed);
    }

    [Fact]
    public async Task CheckStatus_Expired_ReturnsExpired()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(RequestStatusResult.Ok(RequestStatus.Expired, null));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.Expired);
    }

    [Fact]
    public async Task CheckStatus_Cancelled_ReturnsDenied()
    {
        _requesterClient
            .GetStatusAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(RequestStatusResult.Ok(RequestStatus.Cancelled, null));

        var result = await _client.CheckStatusAsync(_registration, "req-123");

        result.Should().Be(TransferStatus.Denied);
    }
}
