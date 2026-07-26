namespace OHPP.Protocol.Models;

public sealed class JwkSet
{
    public required IReadOnlyList<Jwk> Keys { get; init; }
}

public sealed class Jwk
{
    public required string Kty { get; init; }
    public required string Kid { get; init; }
    public required string Alg { get; init; }
    public required string Use { get; init; }
    public required string Crv { get; init; }
    public required string X { get; init; }
    public string? Y { get; init; }
}
