using OHPP.Domain.Shared;

namespace OHPP.Domain.Participation;

public interface IParticipationRequestService
{
    Task<Result<PendingRequest>> SubmitRequestAsync(
        Guid appRegistrationId,
        Guid userId,
        string appId,
        string requestPayloadJson,
        CancellationToken cancellationToken = default);
}
