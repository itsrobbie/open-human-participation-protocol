using System.Text.Json;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;

namespace OHPP.Services.Attestation;

public sealed class CounterSigningService : ICounterSigningService
{
    private readonly IKeyStore _keyStore;
    private readonly ISigner _signer;
    private readonly IKeyEncryptor _keyEncryptor;
    private readonly IClock _clock;

    public CounterSigningService(
        IKeyStore keyStore,
        ISigner signer,
        IKeyEncryptor keyEncryptor,
        IClock clock)
    {
        _keyStore = keyStore;
        _signer = signer;
        _keyEncryptor = keyEncryptor;
        _clock = clock;
    }

    public async Task<Result<string>> CounterSignAsync(
        string innerAttestationJson,
        string deviceSignature,
        string deviceKeyId,
        CancellationToken cancellationToken = default)
    {
        var activeKey = await _keyStore.GetActiveKeyAsync(cancellationToken);
        if (activeKey is null)
        {
            return Error.ServiceUnavailable("No active resolver signing key available");
        }

        var decryptedPrivateKey = _keyEncryptor.Decrypt(activeKey.PrivateKeyPem);

        var envelopePayload = JsonSerializer.Serialize(new
        {
            innerAttestation = innerAttestationJson,
            deviceSignature,
            deviceKeyId,
            resolverKeyId = activeKey.KeyId,
            resolverAlgorithm = activeKey.Algorithm,
            counterSignedAt = _clock.UtcNow.ToString("o")
        });

        var resolverSignature = _signer.Sign(envelopePayload, decryptedPrivateKey);

        var signedEnvelope = JsonSerializer.Serialize(new
        {
            innerAttestation = innerAttestationJson,
            deviceSignature,
            deviceKeyId,
            resolverSignature,
            resolverKeyId = activeKey.KeyId,
            resolverAlgorithm = activeKey.Algorithm,
            counterSignedAt = _clock.UtcNow.ToString("o")
        });

        return signedEnvelope;
    }
}
