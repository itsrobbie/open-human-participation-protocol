using OHPP.Domain.Shared;

namespace OHPP.Domain.Attestation;

public interface ICounterSigningService
{
    Task<Result<string>> CounterSignAsync(
        string innerAttestationJson,
        string deviceSignature,
        string deviceKeyId,
        CancellationToken cancellationToken = default);
}
