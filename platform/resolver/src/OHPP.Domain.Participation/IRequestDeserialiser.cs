namespace OHPP.Domain.Participation;

public sealed class DeserialisedRequest
{
    public required string UserId { get; init; }
    public required string Summary { get; init; }
    public string? Description { get; init; }
    public string? Category { get; init; }
    public required string Type { get; init; }
    public DateTimeOffset? Expiry { get; init; }
}

public interface IRequestDeserialiser
{
    DeserialisedRequest? Deserialise(string requestPayloadJson);
}
