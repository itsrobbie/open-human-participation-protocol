namespace OHPP.Protocol.Models;

public sealed class ServiceMetadata
{
    public required string Name { get; init; }
    public required ProtocolVersionRange ProtocolVersion { get; init; }
    public required ServiceEndpoints Endpoints { get; init; }
}

public sealed class ProtocolVersionRange
{
    public required string Min { get; init; }
    public required string Max { get; init; }
}

public sealed class ServiceEndpoints
{
    public required string Participate { get; init; }
    public required string ParticipateStatus { get; init; }
    public required string Keys { get; init; }
    public string? Federation { get; init; }
}
