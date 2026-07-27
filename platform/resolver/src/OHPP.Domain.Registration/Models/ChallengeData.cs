namespace OHPP.Domain.Registration.Models;

public sealed class ChallengeData
{
    public required string ChallengeId { get; init; }
    public required string RequesterAppId { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}
