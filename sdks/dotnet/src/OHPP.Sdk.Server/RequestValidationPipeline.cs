using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using OHPP.Protocol.Validation;

namespace OHPP.Sdk.Server;

/// <summary>
/// Validates inbound participation request payloads against the protocol schema.
/// Runs before the host's IOhppResolverServices.ProcessParticipationRequestAsync is called.
/// </summary>
public static class RequestValidationPipeline
{
    /// <summary>
    /// Deserialises and validates a raw participation request payload.
    /// Returns validation errors if any, or empty list on success.
    /// </summary>
    public static IReadOnlyList<string> Validate(string? payloadJson, DateTimeOffset currentTime)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
            return new[] { "Request payload is required" };

        ParticipationRequest? request;
        try
        {
            request = OhppJsonSerialiser.Deserialise<ParticipationRequest>(payloadJson);
        }
        catch
        {
            return new[] { "Request payload is not valid JSON" };
        }

        if (request is null)
            return new[] { "Request payload deserialised to null" };

        return ParticipationRequestValidator.Validate(request, currentTime);
    }
}
