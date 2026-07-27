using OHPP.Domain.Participation;
using OHPP.Domain.Shared;

namespace OHPP.Services.Participation;

public sealed class ExpiryEnforcementService : IExpiryEnforcementService
{
    private readonly IPendingRequestRepository _pendingRequestRepo;
    private readonly IParticipationRecordRepository _recordRepo;
    private readonly INotificationChannel _channel;
    private readonly IClock _clock;

    public ExpiryEnforcementService(
        IPendingRequestRepository pendingRequestRepo,
        IParticipationRecordRepository recordRepo,
        INotificationChannel channel,
        IClock clock)
    {
        _pendingRequestRepo = pendingRequestRepo;
        _recordRepo = recordRepo;
        _channel = channel;
        _clock = clock;
    }

    public async Task<int> EnforceExpiredRequestsAsync(CancellationToken cancellationToken = default)
    {
        var expired = await _pendingRequestRepo.GetExpiredPendingAsync(_clock.UtcNow, cancellationToken);
        var count = 0;

        foreach (var request in expired)
        {
            await _pendingRequestRepo.UpdateStatusAsync(request.Id, "Expired", _clock.UtcNow, cancellationToken);

            var record = new ParticipationRecord
            {
                Id = Guid.NewGuid(),
                RequestId = request.Id,
                UserId = request.UserId,
                AppRegistrationId = request.AppRegistrationId,
                Status = "Expired",
                AppId = request.AppId,
                AppName = request.AppId,
                ActionSummary = request.ActionSummary,
                Type = request.Type,
                ResolutionMethod = "System",
                CreatedAt = request.CreatedAt,
                ResolvedAt = _clock.UtcNow
            };

            await _recordRepo.CreateAsync(record, cancellationToken);

            try
            {
                var payload = System.Text.Json.JsonSerializer.Serialize(new
                {
                    requestId = request.Id,
                    status = "Expired"
                });
                await _channel.NotifyDevicesAsync(request.UserId, "request_expired", payload, cancellationToken);
            }
            catch
            {
                // Notification failure is non-fatal for expiry enforcement
            }

            count++;
        }

        return count;
    }

    public bool CheckAndExpireIfNeeded(PendingRequest request)
    {
        if (request.Status != "Pending")
            return false;

        if (request.ExpiresAt is null)
            return false;

        return request.ExpiresAt.Value <= _clock.UtcNow;
    }
}
