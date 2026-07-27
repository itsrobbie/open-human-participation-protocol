using OHPP.Domain.Attestation;

namespace OHPP.Services.Attestation;

public sealed class JwksService : IJwksService
{
    private readonly IKeyStore _keyStore;

    public JwksService(IKeyStore keyStore)
    {
        _keyStore = keyStore;
    }

    public async Task<IReadOnlyList<JwkEntry>> GetAllPublicKeysAsync(CancellationToken cancellationToken = default)
    {
        var keys = await _keyStore.GetAllKeysAsync(cancellationToken);

        return keys.Select(k => new JwkEntry
        {
            KeyId = k.KeyId,
            Algorithm = k.Algorithm,
            PublicKeyPem = k.PublicKeyPem,
            IsActive = k.IsActive
        }).ToList();
    }
}
