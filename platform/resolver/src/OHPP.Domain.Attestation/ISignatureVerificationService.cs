using OHPP.Domain.Shared;

namespace OHPP.Domain.Attestation;

public sealed class VerificationResult
{
    public required bool IsValid { get; init; }
    public string? Error { get; init; }
    public string? KeyId { get; init; }
    public string? Algorithm { get; init; }
}

public interface ISignatureVerificationService
{
    Task<VerificationResult> VerifyAttestationAsync(
        string attestationJson,
        string signature,
        string keyId,
        CancellationToken cancellationToken = default);
}
