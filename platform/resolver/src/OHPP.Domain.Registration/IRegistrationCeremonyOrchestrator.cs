using OHPP.Domain.Shared;

namespace OHPP.Domain.Registration;

public interface IRegistrationCeremonyOrchestrator
{
    Task<Result<AppRegistration>> ProcessChallengeAsync(Guid userId, string challengePayloadBase64, CancellationToken cancellationToken = default);
    Task<Result<bool>> RevokeAppAsync(Guid userId, Guid appRegistrationId, CancellationToken cancellationToken = default);
}
