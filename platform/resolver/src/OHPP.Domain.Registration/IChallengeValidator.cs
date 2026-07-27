using OHPP.Domain.Registration.Models;
using OHPP.Domain.Shared;

namespace OHPP.Domain.Registration;

public interface IChallengeValidator
{
    Result<ChallengeData> ValidateAndDecode(string challengePayloadBase64);
}
