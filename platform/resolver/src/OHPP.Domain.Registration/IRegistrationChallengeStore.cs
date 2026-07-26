namespace OHPP.Domain.Registration;

public interface IRegistrationChallengeStore
{
    Task StoreAsync(RegistrationChallengeRecord challenge, CancellationToken cancellationToken = default);
    Task<RegistrationChallengeRecord?> GetAsync(string challengeId, CancellationToken cancellationToken = default);
    Task MarkCompletedAsync(string challengeId, CancellationToken cancellationToken = default);
}

public sealed class RegistrationChallengeRecord
{
    public required string ChallengeId { get; set; }
    public required string RequesterAppId { get; set; }
    public required Guid UserId { get; set; }
    public required DateTimeOffset ExpiresAt { get; set; }
    public required DateTimeOffset CreatedAt { get; set; }
    public bool IsCompleted { get; set; }
    public string? AppName { get; set; }
    public string? AppIcon { get; set; }
    public string? CallbackPath { get; set; }
}
