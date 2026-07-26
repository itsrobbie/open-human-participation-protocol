namespace OHPP.Domain.Registration;

public sealed class AppRegistration
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string AppId { get; set; }
    public required string AppName { get; set; }
    public string? AppIcon { get; set; }
    public required string AccessToken { get; set; }
    public required string ResolverBaseUrl { get; set; }
    public DateTimeOffset RegisteredAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsActive => RevokedAt is null;
}
