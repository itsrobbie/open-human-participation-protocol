namespace OHPP.Domain.Auth;

public sealed class User
{
    public Guid Id { get; set; }
    public required string ExternalId { get; set; }
    public required string DisplayName { get; set; }
    public required string Email { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastLoginAt { get; set; }
}

public sealed class Device
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string Name { get; set; }
    public required string DeviceType { get; set; }
    /// <summary>
    /// Stable per-install identifier supplied by the client (e.g. a UUID kept
    /// in the device's secure storage). Combined with <see cref="UserId"/> this
    /// is the device's natural key: re-registering the same install updates the
    /// existing row instead of creating a duplicate. Nullable for rows created
    /// before this field existed.
    /// </summary>
    public string? DeviceIdentifier { get; set; }
    public string? PublicKey { get; set; }
    public string? KeyAlgorithm { get; set; }
    public required string DeviceToken { get; set; }
    public string? PushToken { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset RegisteredAt { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
}

public sealed class AuthenticatedPrincipal
{
    public required Guid UserId { get; init; }
    public required TokenType TokenType { get; init; }
    public Guid? DeviceId { get; init; }
    public Guid? AppRegistrationId { get; init; }
    public string? AppId { get; init; }
}

public enum TokenType
{
    IdentityProvider,
    Device,
    AppAccess,
    Unknown
}
