namespace OHPP.Domain.Attestation;

public interface IKeyStore
{
    Task<SigningKey?> GetActiveKeyAsync(CancellationToken cancellationToken = default);
    Task<SigningKey?> GetByKeyIdAsync(string keyId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SigningKey>> GetAllKeysAsync(CancellationToken cancellationToken = default);
    Task<SigningKey> CreateKeyAsync(SigningKey key, CancellationToken cancellationToken = default);
    Task RetireKeyAsync(string keyId, CancellationToken cancellationToken = default);
}
