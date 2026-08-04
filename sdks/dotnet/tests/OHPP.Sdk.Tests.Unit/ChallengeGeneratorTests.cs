using FluentAssertions;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class ChallengeGeneratorTests
{
    private readonly OhppRequesterOptions _options = new()
    {
        AppId = "bank.example.com",
        AppName = "Test Bank",
        CallbackPath = "/ohpp/callback",
        BaseUrl = "https://bank.example.com"
    };

    [Fact]
    public void GenerateChallenge_ProducesValidPayload()
    {
        var generator = new ChallengeGenerator(_options);

        var challenge = generator.CreateChallenge(TimeSpan.FromMinutes(10));

        challenge.ChallengeId.Should().NotBeNullOrWhiteSpace();
        challenge.RequesterAppId.Should().Be("bank.example.com");
        challenge.ExpiresAt.Should().BeAfter(DateTimeOffset.UtcNow);
        challenge.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void GenerateChallenge_DefaultsToFiveMinuteExpiry()
    {
        var challenge = new ChallengeGenerator(_options).CreateChallenge();

        (challenge.ExpiresAt - challenge.CreatedAt).Should().BeCloseTo(TimeSpan.FromMinutes(5), TimeSpan.FromMilliseconds(10));
    }

    [Fact]
    public void GenerateChallenge_UsesCustomValidity()
    {
        var challenge = new ChallengeGenerator(_options).CreateChallenge(TimeSpan.FromMinutes(17));

        (challenge.ExpiresAt - challenge.CreatedAt).Should().BeCloseTo(TimeSpan.FromMinutes(17), TimeSpan.FromMilliseconds(10));
    }

    [Fact]
    public void GenerateChallenge_EncodesAsBase64Url()
    {
        var generator = new ChallengeGenerator(_options);
        var challenge = generator.CreateChallenge();

        var encoded = ChallengeGenerator.EncodeChallenge(challenge);

        encoded.Should().NotBeNullOrWhiteSpace();
        encoded.Should().NotContain("+");
        encoded.Should().NotContain("/");
        encoded.Should().NotContain("=");
    }

    [Fact]
    public void RoundTrip_ChallengeEncodeAndDecode_ProducesSameValues()
    {
        var generator = new ChallengeGenerator(_options);
        var original = generator.CreateChallenge(TimeSpan.FromMinutes(5));

        var encoded = ChallengeGenerator.EncodeChallenge(original);
        var decoded = ChallengeGenerator.DecodeChallenge(encoded);

        decoded.Should().NotBeNull();
        decoded!.ChallengeId.Should().Be(original.ChallengeId);
        decoded.RequesterAppId.Should().Be(original.RequesterAppId);
        decoded.ExpiresAt.Should().BeCloseTo(original.ExpiresAt, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public void BuildChallengeUri_ProducesCorrectFormat()
    {
        var generator = new ChallengeGenerator(_options);
        var challenge = generator.CreateChallenge();

        var uri = ChallengeGenerator.BuildChallengeUri(challenge);

        uri.Should().StartWith("ohpp://register?challenge=");

        // Extract just the challenge value and verify it's proper base64url (no +, no /, no =)
        var challengeValue = uri.Split("challenge=")[1];
        challengeValue.Should().NotContain("+");
        challengeValue.Should().NotContain("/");
        challengeValue.Should().NotContain("=");
    }

    [Fact]
    public void DecodeChallenge_InvalidBase64_ReturnsNull()
    {
        var result = ChallengeGenerator.DecodeChallenge("not-valid-base64!!!");

        result.Should().BeNull();
    }

    [Fact]
    public void DecodeChallenge_ValidBase64ButInvalidJson_ReturnsNull()
    {
        var encoded = Convert.ToBase64String("not json"u8.ToArray())
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var result = ChallengeGenerator.DecodeChallenge(encoded);

        result.Should().BeNull();
    }
}
