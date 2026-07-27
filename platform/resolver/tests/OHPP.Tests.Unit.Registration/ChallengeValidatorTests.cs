using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Shared;
using OHPP.Services.Registration;
using Xunit;

namespace OHPP.Tests.Unit.Registration;

public class ChallengeValidatorTests
{
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly ChallengeValidator _sut;

    public ChallengeValidatorTests()
    {
        _clock.UtcNow.Returns(new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero));
        _sut = new ChallengeValidator(_clock);
    }

    [Fact]
    public void ValidateAndDecode_ValidChallenge_ReturnsChallenge()
    {
        var challenge = CreateValidChallengeBase64();

        var result = _sut.ValidateAndDecode(challenge);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RequesterAppId.Should().Be("bank.test");
    }

    [Fact]
    public void ValidateAndDecode_ExpiredChallenge_ReturnsError()
    {
        var challenge = CreateExpiredChallengeBase64();

        var result = _sut.ValidateAndDecode(challenge);

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("expired");
    }

    [Fact]
    public void ValidateAndDecode_EmptyAppId_ReturnsValidationError()
    {
        var challenge = CreateChallengeBase64(appId: "");

        var result = _sut.ValidateAndDecode(challenge);

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("AppId");
    }

    [Fact]
    public void ValidateAndDecode_InvalidAppIdFormat_ReturnsValidationError()
    {
        var challenge = CreateChallengeBase64(appId: "not a domain");

        var result = _sut.ValidateAndDecode(challenge);

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("domain");
    }

    [Fact]
    public void ValidateAndDecode_MalformedBase64Payload_ReturnsError()
    {
        var result = _sut.ValidateAndDecode("!!!not-base64!!!");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("decode");
    }

    private string CreateValidChallengeBase64(string appId = "bank.test")
    {
        return CreateChallengeBase64(appId, _clock.UtcNow.AddMinutes(5));
    }

    private string CreateExpiredChallengeBase64()
    {
        return CreateChallengeBase64("bank.test", _clock.UtcNow.AddMinutes(-1));
    }

    private string CreateChallengeBase64(string appId, DateTimeOffset? expiresAt = null)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            challengeId = Guid.NewGuid().ToString(),
            requesterAppId = appId,
            expiresAt = (expiresAt ?? _clock.UtcNow.AddMinutes(5)).ToString("O"),
            createdAt = _clock.UtcNow.AddSeconds(-10).ToString("O")
        });
        return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
