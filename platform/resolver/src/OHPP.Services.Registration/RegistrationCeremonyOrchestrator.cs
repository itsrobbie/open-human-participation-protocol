using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Registration.Models;
using OHPP.Domain.Shared;

namespace OHPP.Services.Registration;

public class RegistrationCeremonyOrchestrator : IRegistrationCeremonyOrchestrator
{
    private readonly IChallengeValidator _challengeValidator;
    private readonly IAppMetadataFetcher _metadataFetcher;
    private readonly IAppMetadataValidator _metadataValidator;
    private readonly IRegistrationCallbackSender _callbackSender;
    private readonly IAppRegistrationRepository _registrationRepo;
    private readonly IPendingRequestRepository _pendingRequestRepo;
    private readonly ITokenGenerator _tokenGenerator;
    private readonly IRateLimitStore _rateLimitStore;
    private readonly IResolverConfiguration _resolverConfig;
    private readonly IClock _clock;

    public RegistrationCeremonyOrchestrator(
        IChallengeValidator challengeValidator,
        IAppMetadataFetcher metadataFetcher,
        IAppMetadataValidator metadataValidator,
        IRegistrationCallbackSender callbackSender,
        IAppRegistrationRepository registrationRepo,
        IPendingRequestRepository pendingRequestRepo,
        ITokenGenerator tokenGenerator,
        IRateLimitStore rateLimitStore,
        IResolverConfiguration resolverConfig,
        IClock clock)
    {
        _challengeValidator = challengeValidator;
        _metadataFetcher = metadataFetcher;
        _metadataValidator = metadataValidator;
        _callbackSender = callbackSender;
        _registrationRepo = registrationRepo;
        _pendingRequestRepo = pendingRequestRepo;
        _tokenGenerator = tokenGenerator;
        _rateLimitStore = rateLimitStore;
        _resolverConfig = resolverConfig;
        _clock = clock;
    }

    public async Task<Result<AppRegistration>> ProcessChallengeAsync(
        Guid userId, string challengePayloadBase64, CancellationToken cancellationToken = default)
    {
        // Rate limit check
        var rateLimitKey = $"registration:{userId}";
        if (await _rateLimitStore.IsRateLimitedAsync(rateLimitKey, _resolverConfig.MaxRegistrationsPerHour, TimeSpan.FromHours(1), cancellationToken))
            return Error.RateLimited("Registration rate limit exceeded");

        // Decode and validate challenge
        var challengeResult = _challengeValidator.ValidateAndDecode(challengePayloadBase64);
        if (challengeResult.IsFailure)
            return challengeResult.Error!;

        var challenge = challengeResult.Value!;

        // Fetch app metadata
        AppMetadataData? metadata;
        try
        {
            metadata = await _metadataFetcher.FetchAsync(challenge.RequesterAppId, cancellationToken);
        }
        catch (Exception)
        {
            return Error.ServiceUnavailable("Failed to fetch app metadata from requester");
        }
        if (metadata is null)
            return Error.Validation("App metadata not found at requester", Array.Empty<ValidationFailure>());

        // Validate metadata
        var metadataValidation = _metadataValidator.Validate(metadata, challenge.RequesterAppId);
        if (metadataValidation.IsFailure)
            return metadataValidation.Error!;

        // A device/app connection is keyed on (user, appId): re-registering the
        // same app must UPDATE the existing registration in place, not create a
        // duplicate row. Keep the current registration active until the
        // requester accepts the replacement callback, so a replayed or failed
        // challenge never breaks a working connection.
        var existing = await _registrationRepo.GetActiveByUserAndAppIdAsync(userId, challenge.RequesterAppId, cancellationToken);

        // Generate access token. Reuse the existing registration's Id when one
        // exists so the requester's stored registration (keyed on that Id via
        // ON CONFLICT) is updated rather than duplicated.
        var accessToken = _tokenGenerator.GenerateAppAccessToken();
        var registrationId = existing?.Id ?? Guid.NewGuid();

        // Build registration response
        var response = new RegistrationResponseData
        {
            ChallengeId = challenge.ChallengeId,
            ResolverBaseUrl = _resolverConfig.BaseUrl,
            UserId = userId.ToString(),
            AccessToken = accessToken,
            RegistrationId = registrationId.ToString(),
            CreatedAt = _clock.UtcNow
        };

        // Send callback
        bool callbackSuccess;
        try
        {
            callbackSuccess = await _callbackSender.SendAsync(challenge.RequesterAppId, metadata.RegistrationCallbackPath, response, cancellationToken);
        }
        catch (Exception)
        {
            return Error.ServiceUnavailable("Registration callback to requester failed");
        }

        if (!callbackSuccess)
            return Error.ServiceUnavailable("Registration callback to requester failed");

        AppRegistration registration;
        if (existing is not null)
        {
            // Update in place: rotate the token, refresh metadata, keep one row.
            existing.AppName = metadata.Name;
            existing.AppIcon = metadata.Icon;
            existing.AccessToken = accessToken;
            existing.ResolverBaseUrl = _resolverConfig.BaseUrl;
            existing.RegisteredAt = _clock.UtcNow;
            existing.RevokedAt = null;
            await _registrationRepo.UpdateAsync(existing, cancellationToken);
            registration = existing;
        }
        else
        {
            registration = new AppRegistration
            {
                Id = registrationId,
                UserId = userId,
                AppId = challenge.RequesterAppId,
                AppName = metadata.Name,
                AppIcon = metadata.Icon,
                AccessToken = accessToken,
                ResolverBaseUrl = _resolverConfig.BaseUrl,
                RegisteredAt = _clock.UtcNow
            };
            registration = await _registrationRepo.CreateAsync(registration, cancellationToken);
        }

        // Increment rate limit counter
        await _rateLimitStore.IncrementAsync(rateLimitKey, TimeSpan.FromHours(1), cancellationToken);

        return registration;
    }

    public async Task<Result<bool>> RevokeAppAsync(
        Guid userId, Guid appRegistrationId, CancellationToken cancellationToken = default)
    {
        var registration = await _registrationRepo.GetByIdAsync(appRegistrationId, cancellationToken);

        if (registration is null || registration.UserId != userId)
            return Error.NotFound("App registration not found");

        if (registration.RevokedAt.HasValue)
            return Error.Conflict("App registration is already revoked");

        registration.RevokedAt = _clock.UtcNow;
        await _registrationRepo.UpdateAsync(registration, cancellationToken);
        await _pendingRequestRepo.CancelAllForAppRegistrationAsync(appRegistrationId, cancellationToken);

        return true;
    }
}
