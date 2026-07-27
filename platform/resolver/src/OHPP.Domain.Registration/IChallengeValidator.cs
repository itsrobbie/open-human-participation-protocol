using OHPP.Domain.Shared;
using OHPP.Protocol.Models;

namespace OHPP.Domain.Registration;

public interface IChallengeValidator
{
    Result<RegistrationChallenge> ValidateAndDecode(string challengePayloadBase64);
}
