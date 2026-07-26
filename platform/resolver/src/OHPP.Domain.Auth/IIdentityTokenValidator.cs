namespace OHPP.Domain.Auth;

public interface IIdentityTokenValidator
{
    Task<IdentityTokenClaims> ValidateAsync(string token, CancellationToken cancellationToken = default);
}

public sealed class IdentityTokenClaims
{
    public required string ExternalId { get; init; }
    public required string Email { get; init; }
    public string? DisplayName { get; init; }
}
