using FluentAssertions;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using OHPP.Cli.Services;
using Xunit;

namespace OHPP.Cli.Tests.Unit;

public sealed class ChallengeProcessorTests
{
    private readonly ChallengeProcessor _processor = new();
    private static readonly DateTimeOffset Now = new(2026, 7, 28, 12, 0, 0, TimeSpan.Zero);

    private static string BuildValidUri(DateTimeOffset? expiresAt = null)
    {
        var challenge = new RegistrationChallenge
        {
            ChallengeId = Guid.NewGuid().ToString("N"),
            RequesterAppId = "bank.example.com",
            ExpiresAt = expiresAt ?? Now.AddMinutes(5),
            CreatedAt = Now
        };
        return ChallengeGenerator.BuildChallengeUri(challenge);
    }

    [Fact]
    public void ChallengeProcessor_ValidUri_DecodesChallenge()
    {
        var uri = BuildValidUri();

        var result = _processor.Process(uri, Now);

        result.Success.Should().BeTrue();
        result.Challenge.Should().NotBeNull();
        result.Challenge!.RequesterAppId.Should().Be("bank.example.com");
        result.Challenge.ExpiresAt.Should().BeAfter(Now);
    }

    [Fact]
    public void ChallengeProcessor_InvalidUri_ReturnsError()
    {
        var result = _processor.Process("https://not-ohpp.com/something", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("ohpp://");
    }

    [Fact]
    public void ChallengeProcessor_ExpiredChallenge_ReturnsError()
    {
        var uri = BuildValidUri(expiresAt: Now.AddMinutes(-1));

        var result = _processor.Process(uri, Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("expired");
    }

    [Fact]
    public void ChallengeProcessor_EmptyUri_ReturnsError()
    {
        var result = _processor.Process("", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("empty");
    }

    [Fact]
    public void ChallengeProcessor_MissingQueryParam_ReturnsError()
    {
        var result = _processor.Process("ohpp://register", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("query");
    }

    [Fact]
    public void ChallengeProcessor_WrongPath_ReturnsError()
    {
        var result = _processor.Process("ohpp://somethingelse?challenge=abc", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("register");
    }

    [Fact]
    public void ChallengeProcessor_MalformedBase64_ReturnsError()
    {
        var result = _processor.Process("ohpp://register?challenge=not_valid_base64!!!", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("decode");
    }

    [Fact]
    public void ChallengeProcessor_EmptyChallengeParam_ReturnsError()
    {
        var result = _processor.Process("ohpp://register?challenge=", Now);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("empty");
    }
}
