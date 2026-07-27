using OHPP.Domain.Attestation;

namespace OHPP.Services.Attestation;

public sealed class SignatureVerificationService : ISignatureVerificationService
{
    private readonly IKeyStore _keyStore;
    private readonly ISignatureVerifier _signatureVerifier;

    public SignatureVerificationService(IKeyStore keyStore, ISignatureVerifier signatureVerifier)
    {
        _keyStore = keyStore;
        _signatureVerifier = signatureVerifier;
    }

    public async Task<VerificationResult> VerifyAttestationAsync(
        string attestationJson,
        string signature,
        string keyId,
        CancellationToken cancellationToken = default)
    {
        var key = await _keyStore.GetByKeyIdAsync(keyId, cancellationToken);
        if (key is null)
        {
            return new VerificationResult
            {
                IsValid = false,
                Error = $"Unknown key ID: no signing key found for key '{keyId}'"
            };
        }

        var isValid = _signatureVerifier.Verify(attestationJson, signature, key.PublicKeyPem);
        if (!isValid)
        {
            return new VerificationResult
            {
                IsValid = false,
                Error = "Signature verification failed: payload does not match signature"
            };
        }

        return new VerificationResult
        {
            IsValid = true,
            KeyId = key.KeyId,
            Algorithm = key.Algorithm
        };
    }
}
