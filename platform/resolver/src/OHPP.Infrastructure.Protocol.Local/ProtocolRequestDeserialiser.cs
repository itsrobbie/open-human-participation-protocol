using OHPP.Domain.Participation;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Infrastructure.Protocol.Local;

public sealed class ProtocolRequestDeserialiser : IRequestDeserialiser
{
    public DeserialisedRequest? Deserialise(string requestPayloadJson)
    {
        var request = OhppJsonSerialiser.Deserialise<ParticipationRequest>(requestPayloadJson);
        if (request is null)
            return null;

        return new DeserialisedRequest
        {
            UserId = request.Validation.UserId,
            Summary = request.Action.Summary,
            Description = request.Action.Description,
            Category = request.Action.Category,
            Type = request.Type.ToString(),
            Expiry = request.Expiry
        };
    }
}
