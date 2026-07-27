using System.Text.Json;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;

namespace OHPP.Services.Participation;

public sealed class RequestLifecycleManager : IRequestLifecycleManager
{
    private readonly IPendingRequestRepository _pendingRequestRepo;
    private readonly IParticipationRecordRepository _recordRepo;
    private readonly IExpiryEnforcementService _expiryService;
    private readonly INotificationChannel _channel;
    private readonly IClock _clock;

    public RequestLifecycleManager(
        IPendingRequestRepository pendingRequestRepo,
        IParticipationRecordRepository recordRepo,
        IExpiryEnforcementService expiryService,
        INotificationChannel channel,
        IClock clock)
    {
        _pendingRequestRepo = pendingRequestRepo;
        _recordRepo = recordRepo;
        _expiryService = expiryService;
        _channel = channel;
        _clock = clock;
    }

    public async Task<Result<PendingRequest>> GetStatusAsync(
        Guid requestId,
        Guid appRegistrationId,
        CancellationToken cancellationToken = default)
    {
        var request = await _pendingRequestRepo.GetByIdForAppAsync(requestId, appRegistrationId, cancellationToken);

        if (request is null)
            return Error.NotFound("Request not found");

        // Lazy expiry check
        if (_expiryService.CheckAndExpireIfNeeded(request))
        {
            await _pendingRequestRepo.UpdateStatusAsync(request.Id, "Expired", _clock.UtcNow, cancellationToken);
            request.Status = "Expired";
            request.ResolvedAt = _clock.UtcNow;
        }

        return request;
    }

    public async Task<Result<bool>> CancelRequestAsync(
        Guid requestId,
        Guid appRegistrationId,
        CancellationToken cancellationToken = default)
    {
        var request = await _pendingRequestRepo.GetByIdForAppAsync(requestId, appRegistrationId, cancellationToken);

        if (request is null)
            return Error.NotFound("Request not found");

        if (request.Status != "Pending")
            return Error.Conflict($"Cannot cancel request in '{request.Status}' state");

        // Check lazy expiry before proceeding
        if (_expiryService.CheckAndExpireIfNeeded(request))
        {
            await _pendingRequestRepo.UpdateStatusAsync(request.Id, "Expired", _clock.UtcNow, cancellationToken);
            return Error.Conflict("Cannot cancel request in 'Expired' state");
        }

        await _pendingRequestRepo.UpdateStatusAsync(request.Id, "Cancelled", _clock.UtcNow, cancellationToken);

        var record = new ParticipationRecord
        {
            Id = Guid.NewGuid(),
            RequestId = request.Id,
            UserId = request.UserId,
            AppRegistrationId = request.AppRegistrationId,
            Status = "Cancelled",
            AppId = request.AppId,
            AppName = request.AppId,
            ActionSummary = request.ActionSummary,
            Type = request.Type,
            ResolutionMethod = "AppCancelled",
            CreatedAt = request.CreatedAt,
            ResolvedAt = _clock.UtcNow
        };

        await _recordRepo.CreateAsync(record, cancellationToken);

        try
        {
            var payload = JsonSerializer.Serialize(new
            {
                requestId = request.Id,
                status = "Cancelled"
            });
            await _channel.NotifyDevicesAsync(request.UserId, "request_cancelled", payload, cancellationToken);
        }
        catch
        {
            // Notification failure is non-fatal for cancellation
        }

        return true;
    }
}
