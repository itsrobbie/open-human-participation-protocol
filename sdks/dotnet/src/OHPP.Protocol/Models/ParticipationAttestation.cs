namespace OHPP.Protocol.Models;

public sealed class ParticipationAttestation
{
    public required string Id { get; init; }
    public required string RequestId { get; init; }
    public required string Version { get; init; }
    public required DecisionInfo Decision { get; init; }
    public required ResolutionInfo Resolution { get; init; }
    public required SignatureInfo Signature { get; init; }
    public required DateTimeOffset IssuedAt { get; init; }
}

public sealed class DecisionInfo
{
    public string? SelectedOption { get; init; }
    public IReadOnlyList<string>? SelectedOptions { get; init; }
    public string? Value { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
}

public sealed class ResolutionInfo
{
    public required ResolutionMethod Method { get; init; }
    public required EndpointInfo Endpoint { get; init; }
    public string? AutoApproveRule { get; init; }
    public string? DelegatedTo { get; init; }
    public ParticipationAttestation? DelegatedAttestation { get; init; }
}

public sealed class EndpointInfo
{
    public required string Type { get; init; }
    public required string Id { get; init; }
}

public sealed class SignatureInfo
{
    public required SignatureAlgorithm Algorithm { get; init; }
    public required string Value { get; init; }
    public required string KeyId { get; init; }
}
