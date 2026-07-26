namespace OHPP.Protocol.Models;

public sealed class RegistrationChallenge
{
    public required string ChallengeId { get; init; }
    public required string RequesterAppId { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public sealed class RegistrationResponse
{
    public required string ChallengeId { get; init; }
    public required string ResolverBaseUrl { get; init; }
    public required string UserId { get; init; }
    public required string AccessToken { get; init; }
    public required string RegistrationId { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public sealed class RequesterAppMetadata
{
    public required string AppId { get; init; }
    public required string Name { get; init; }
    public string? Icon { get; init; }
    public required AppEndpoints Endpoints { get; init; }
    public required string Version { get; init; }
}

public sealed class AppEndpoints
{
    public required string RegistrationCallback { get; init; }
}
