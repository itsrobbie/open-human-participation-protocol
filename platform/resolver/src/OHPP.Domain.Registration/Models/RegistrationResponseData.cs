namespace OHPP.Domain.Registration.Models;

public sealed class RegistrationResponseData
{
    public required string ChallengeId { get; init; }
    public required string ResolverBaseUrl { get; init; }
    public required string UserId { get; init; }
    public required string AccessToken { get; init; }
    public required string RegistrationId { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}
