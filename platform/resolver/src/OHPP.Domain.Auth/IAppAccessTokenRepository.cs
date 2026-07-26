namespace OHPP.Domain.Auth;

public interface IAppAccessTokenRepository
{
    Task<AppRegistrationToken?> GetByTokenAsync(string accessToken, CancellationToken cancellationToken = default);
}

/// <summary>
/// Lightweight projection used during auth resolution — just enough to identify the app + user pair.
/// </summary>
public sealed class AppRegistrationToken
{
    public required Guid AppRegistrationId { get; init; }
    public required Guid UserId { get; init; }
    public required string AppId { get; init; }
    public required DateTimeOffset? RevokedAt { get; init; }
}
