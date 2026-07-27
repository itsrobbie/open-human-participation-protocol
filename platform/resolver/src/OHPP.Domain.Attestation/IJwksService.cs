namespace OHPP.Domain.Attestation;

public sealed class JwkEntry
{
    public required string KeyId { get; init; }
    public required string Algorithm { get; init; }
    public required string PublicKeyPem { get; init; }
    public required bool IsActive { get; init; }
}

public interface IJwksService
{
    Task<IReadOnlyList<JwkEntry>> GetAllPublicKeysAsync(CancellationToken cancellationToken = default);
}
