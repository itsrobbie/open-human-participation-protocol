using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;

namespace OHPP.Services.Participation;

public sealed class ParticipationRequestService : IParticipationRequestService
{
    private readonly IPendingRequestRepository _pendingRequestRepo;
    private readonly IDeviceTokenRepository _deviceTokenRepo;
    private readonly IAppRegistrationRepository _appRegistrationRepo;
    private readonly IRateLimitStore _rateLimitStore;
    private readonly INotificationService _notificationService;
    private readonly INotificationChannel _notificationChannel;
    private readonly IRequestValidator _requestValidator;
    private readonly IRequestDeserialiser _requestDeserialiser;
    private readonly IClock _clock;

    private const int MaxPendingRequestsPerUser = 50;
    private static readonly TimeSpan RateLimitWindow = TimeSpan.FromMinutes(1);

    public ParticipationRequestService(
        IPendingRequestRepository pendingRequestRepo,
        IDeviceTokenRepository deviceTokenRepo,
        IAppRegistrationRepository appRegistrationRepo,
        IRateLimitStore rateLimitStore,
        INotificationService notificationService,
        INotificationChannel notificationChannel,
        IRequestValidator requestValidator,
        IRequestDeserialiser requestDeserialiser,
        IClock clock)
    {
        _pendingRequestRepo = pendingRequestRepo;
        _deviceTokenRepo = deviceTokenRepo;
        _appRegistrationRepo = appRegistrationRepo;
        _rateLimitStore = rateLimitStore;
        _notificationService = notificationService;
        _notificationChannel = notificationChannel;
        _requestValidator = requestValidator;
        _requestDeserialiser = requestDeserialiser;
        _clock = clock;
    }

    public async Task<Result<PendingRequest>> SubmitRequestAsync(
        Guid appRegistrationId,
        Guid userId,
        string appId,
        string requestPayloadJson,
        CancellationToken cancellationToken = default)
    {
        // Deserialise request
        var request = _requestDeserialiser.Deserialise(requestPayloadJson);
        if (request is null)
            return Error.Validation("Invalid request payload JSON", new[]
            {
                new ValidationFailure { Field = "body", Message = "Could not deserialise request" }
            });

        // Validate userId matches request
        if (request.UserId != userId.ToString())
            return Error.Validation("User ID mismatch", new[]
            {
                new ValidationFailure { Field = "validation.userId", Message = "Does not match authenticated user" }
            });

        // Check app registration is still active (not revoked)
        var appRegistration = await _appRegistrationRepo.GetByIdAsync(appRegistrationId, cancellationToken);
        if (appRegistration is null || !appRegistration.IsActive)
            return Error.Unauthorized("App registration is revoked or not found");

        // Validate request payload using protocol validator
        var validationErrors = _requestValidator.Validate(requestPayloadJson, _clock.UtcNow);
        if (validationErrors.Count > 0)
        {
            var failures = validationErrors
                .Select(e => new ValidationFailure { Field = "request", Message = e })
                .ToArray();
            return Error.Validation("Request validation failed", failures);
        }

        // Rate limit check
        var rateLimitKey = $"participation:{appId}:{userId}";
        if (await _rateLimitStore.IsRateLimitedAsync(rateLimitKey, MaxPendingRequestsPerUser, RateLimitWindow, cancellationToken))
            return Error.RateLimited("Participation request rate limit exceeded");

        // Build and store PendingRequest (no device check — requests are stored regardless
        // of whether the user has a device registered yet; they'll be delivered when one connects)

        // Build and store PendingRequest
        var pendingRequest = new PendingRequest
        {
            Id = Guid.NewGuid(),
            AppRegistrationId = appRegistrationId,
            UserId = userId,
            Status = "Pending",
            RequestPayload = requestPayloadJson,
            AppId = appId,
            ActionSummary = request.Summary,
            Type = request.Type,
            CreatedAt = _clock.UtcNow,
            ExpiresAt = request.Expiry,
            ResolvedAt = null
        };

        pendingRequest = await _pendingRequestRepo.CreateAsync(pendingRequest, cancellationToken);

        // Increment rate limit counter
        await _rateLimitStore.IncrementAsync(rateLimitKey, RateLimitWindow, cancellationToken);

        // Notify devices (fire-and-forget — failure is non-fatal)
        try
        {
            await _notificationService.NotifyNewRequestAsync(userId, pendingRequest, cancellationToken);
        }
        catch
        {
            // Notification failure should not fail request submission
        }

        return pendingRequest;
    }
}
