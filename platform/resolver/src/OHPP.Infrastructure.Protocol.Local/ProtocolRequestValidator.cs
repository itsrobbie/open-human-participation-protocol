using OHPP.Domain.Participation;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using OHPP.Protocol.Validation;

namespace OHPP.Infrastructure.Protocol.Local;

public sealed class ProtocolRequestValidator : IRequestValidator
{
    public IReadOnlyList<string> Validate(string requestPayloadJson, DateTimeOffset currentTime)
    {
        var request = OhppJsonSerialiser.Deserialise<ParticipationRequest>(requestPayloadJson);
        if (request is null)
            return new[] { "Could not deserialise request payload" };

        return ParticipationRequestValidator.Validate(request, currentTime);
    }
}
