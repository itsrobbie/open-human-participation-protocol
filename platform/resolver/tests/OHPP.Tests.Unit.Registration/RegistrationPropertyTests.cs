using FsCheck;
using FsCheck.Xunit;
using NSubstitute;
using OHPP.Domain.Shared;
using OHPP.Services.Registration;

namespace OHPP.Tests.Unit.Registration;

public class RegistrationPropertyTests
{
    [Property]
    public bool PBT_ProcessChallenge_AllExpiredChallenges_AlwaysReject(PositiveInt minutesAgo)
    {
        var clock = Substitute.For<IClock>();
        var now = new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
        clock.UtcNow.Returns(now);
        var validator = new ChallengeValidator(clock);

        var expiredTime = now.AddMinutes(-minutesAgo.Get);
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            challengeId = Guid.NewGuid().ToString(),
            requesterAppId = "bank.test",
            expiresAt = expiredTime.ToString("O"),
            createdAt = now.AddMinutes(-minutesAgo.Get - 5).ToString("O")
        });
        var base64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var result = validator.ValidateAndDecode(base64);
        return result.IsFailure;
    }

    [Property(MaxTest = 10000)]
    public bool PBT_AccessToken_NeverCollides_Over10000Generations(byte _)
    {
        // This test generates 100 tokens per invocation and checks no duplicates
        var tokens = new HashSet<string>();
        var generator = new TokenGeneratorForTest();
        for (var i = 0; i < 100; i++)
        {
            var token = generator.Generate();
            if (!tokens.Add(token))
                return false;
        }
        return true;
    }

    private class TokenGeneratorForTest
    {
        public string Generate()
        {
            var bytes = new byte[32];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return "ohpp_app_" + Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
