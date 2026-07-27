using OHPP.Domain.Shared;

namespace OHPP.Domain.Attestation;

public interface IAttestationProcessingService
{
    Task<Result<string>> ProcessDeviceAttestationAsync(
        Guid deviceId,
        Guid userId,
        string requestId,
        string attestationPayloadJson,
        string deviceSignature,
        CancellationToken cancellationToken = default);
}
