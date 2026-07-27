using System.Text;
using System.Text.Json;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Protocol.Models;

namespace OHPP.Services.Registration;

public class ChallengeValidator : IChallengeValidator
{
    private readonly IClock _clock;

    public ChallengeValidator(IClock clock)
    {
        _clock = clock;
    }

    public Result<RegistrationChallenge> ValidateAndDecode(string challengePayloadBase64)
    {
        RegistrationChallenge? challenge;
        try
        {
            var paddedBase64 = challengePayloadBase64.Replace('-', '+').Replace('_', '/');
            switch (paddedBase64.Length % 4)
            {
                case 2: paddedBase64 += "=="; break;
                case 3: paddedBase64 += "="; break;
            }
            var bytes = Convert.FromBase64String(paddedBase64);
            var json = Encoding.UTF8.GetString(bytes);
            challenge = JsonSerializer.Deserialize<RegistrationChallenge>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
        }
        catch (Exception)
        {
            return Error.Validation("Failed to decode challenge payload", Array.Empty<ValidationFailure>());
        }

        if (challenge is null)
            return Error.Validation("Challenge payload is empty", Array.Empty<ValidationFailure>());

        if (string.IsNullOrWhiteSpace(challenge.RequesterAppId))
            return Error.Validation("requesterAppId is required", Array.Empty<ValidationFailure>());

        if (!IsValidDomainFormat(challenge.RequesterAppId))
            return Error.Validation("requesterAppId must be in domain format", Array.Empty<ValidationFailure>());

        if (challenge.ExpiresAt <= _clock.UtcNow)
            return Error.Validation("Challenge has expired", Array.Empty<ValidationFailure>());

        return challenge;
    }

    private static bool IsValidDomainFormat(string appId)
    {
        return appId.Contains('.') && !appId.Contains(' ');
    }
}
