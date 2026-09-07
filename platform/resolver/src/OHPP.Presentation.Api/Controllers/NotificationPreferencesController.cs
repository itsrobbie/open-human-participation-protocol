using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Presentation.Api.Filters;

namespace OHPP.Presentation.Api.Controllers;

[Route("api/notification-preferences")]
[RequireTokenType(TokenType.IdentityProvider)]
public sealed class NotificationPreferencesController : OhppControllerBase
{
    private readonly INotificationPreferenceRepository _prefRepo;
    private readonly IAppRegistrationRepository _appRepo;
    private readonly IClock _clock;

    public NotificationPreferencesController(
        INotificationPreferenceRepository prefRepo,
        IAppRegistrationRepository appRepo,
        IClock clock)
    {
        _prefRepo = prefRepo;
        _appRepo = appRepo;
        _clock = clock;
    }

    [HttpGet(Name = "GetNotificationPreferences")]
    [ProducesResponseType(typeof(NotificationPreferenceResponse[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await _prefRepo.GetByUserIdAsync(UserId);
        return Ok(prefs.Select(p => new NotificationPreferenceResponse(
            p.AppId, p.PushEnabled, p.SoundEnabled, p.BadgeEnabled, p.UpdatedAt)));
    }

    [HttpPut("{appId}", Name = "UpdateNotificationPreference")]
    [ProducesResponseType(typeof(NotificationPreferenceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdatePreference(string appId, [FromBody] UpdateNotificationPreferenceRequest request)
    {
        // Verify the app is registered to this user
        var apps = await _appRepo.GetByUserIdAsync(UserId);
        var matchingApp = apps.FirstOrDefault(a => a.AppId == appId && a.IsActive);
        if (matchingApp is null)
            return NotFound(new { error = $"No active registration found for app '{appId}'" });

        var now = _clock.UtcNow;
        var preference = new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            AppId = appId,
            PushEnabled = request.PushEnabled,
            SoundEnabled = request.SoundEnabled,
            BadgeEnabled = request.BadgeEnabled,
            UpdatedAt = now
        };

        var result = await _prefRepo.CreateOrUpdateAsync(preference);
        return Ok(new NotificationPreferenceResponse(
            result.AppId, result.PushEnabled, result.SoundEnabled, result.BadgeEnabled, result.UpdatedAt));
    }
}

public sealed record UpdateNotificationPreferenceRequest(bool PushEnabled, bool SoundEnabled, bool BadgeEnabled);
public sealed record NotificationPreferenceResponse(string AppId, bool PushEnabled, bool SoundEnabled, bool BadgeEnabled, DateTimeOffset UpdatedAt);
