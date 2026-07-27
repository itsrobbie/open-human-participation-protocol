using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Presentation.Api.Filters;

namespace OHPP.Presentation.Api.Controllers;

[Route("api")]
[RequireTokenType(TokenType.IdentityProvider)]
public sealed class PortalController : OhppControllerBase
{
    private readonly IUserRepository _userRepo;
    private readonly IDeviceTokenRepository _deviceRepo;
    private readonly IAppRegistrationRepository _appRepo;
    private readonly IPendingRequestRepository _pendingRepo;
    private readonly IParticipationRecordRepository _recordRepo;
    private readonly ITokenGenerator _tokenGenerator;

    public PortalController(
        IUserRepository userRepo,
        IDeviceTokenRepository deviceRepo,
        IAppRegistrationRepository appRepo,
        IPendingRequestRepository pendingRepo,
        IParticipationRecordRepository recordRepo,
        ITokenGenerator tokenGenerator)
    {
        _userRepo = userRepo;
        _deviceRepo = deviceRepo;
        _appRepo = appRepo;
        _pendingRepo = pendingRepo;
        _recordRepo = recordRepo;
        _tokenGenerator = tokenGenerator;
    }

    // --- User Profile ---

    [HttpPost("users/me")]
    public async Task<IActionResult> CreateOrGetProfile()
    {
        // User is already created/updated during token resolution in AuthenticationService.
        // This endpoint returns the current user record.
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user is null)
            return NotFound();

        return Ok(user);
    }

    [HttpGet("users/me/summary")]
    public async Task<IActionResult> GetSummary()
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user is null) return NotFound();

        var pendingCount = await _pendingRepo.CountPendingByUserIdAsync(UserId);
        var apps = await _appRepo.GetByUserIdAsync(UserId);
        var devices = await _deviceRepo.GetActiveByUserIdAsync(UserId);

        return Ok(new
        {
            user.DisplayName,
            user.Email,
            pendingCount,
            activeApps = apps.Count(a => a.IsActive),
            activeDevices = devices.Count
        });
    }

    // --- History ---

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _recordRepo.GetByUserIdAsync(UserId, page, pageSize);
        return Ok(result);
    }

    [HttpGet("history/{id:guid}")]
    public async Task<IActionResult> GetHistoryDetail(Guid id)
    {
        var record = await _recordRepo.GetByRequestIdAsync(id);
        if (record is null || record.UserId != UserId)
            return NotFound();

        return Ok(record);
    }

    // --- Devices ---

    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices()
    {
        var devices = await _deviceRepo.GetByUserIdAsync(UserId);
        return Ok(devices.Select(d => new
        {
            d.Id, d.Name, d.DeviceType, d.IsActive,
            d.RegisteredAt, d.LastSeenAt,
            hasKey = d.PublicKey is not null
        }));
    }

    [HttpPost("devices")]
    public async Task<IActionResult> CreateDevice([FromBody] CreateDeviceRequest request)
    {
        var device = new Device
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = request.Name,
            DeviceType = request.DeviceType,
            DeviceToken = _tokenGenerator.GenerateDeviceToken(),
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };

        await _deviceRepo.CreateAsync(device);
        return Created($"/api/devices/{device.Id}", new { device.Id, device.Name, device.DeviceToken });
    }

    [HttpDelete("devices/{id:guid}")]
    public async Task<IActionResult> RevokeDevice(Guid id)
    {
        var device = await _deviceRepo.GetByIdAsync(id);
        if (device is null || device.UserId != UserId)
            return NotFound();

        device.IsActive = false;
        await _deviceRepo.UpdateAsync(device);
        return NoContent();
    }

    // --- Registered Apps ---

    [HttpGet("registrations/apps")]
    public async Task<IActionResult> GetRegisteredApps()
    {
        var apps = await _appRepo.GetByUserIdAsync(UserId);
        return Ok(apps.Select(a => new
        {
            a.Id, a.AppId, a.AppName, a.AppIcon,
            a.RegisteredAt, a.RevokedAt, a.IsActive
        }));
    }

    [HttpDelete("registrations/apps/{id:guid}")]
    public async Task<IActionResult> RevokeApp(Guid id)
    {
        var app = await _appRepo.GetByIdAsync(id);
        if (app is null || app.UserId != UserId)
            return NotFound();

        if (app.RevokedAt is not null)
            return Conflict(new { error = "App already revoked" });

        app.RevokedAt = DateTimeOffset.UtcNow;
        await _appRepo.UpdateAsync(app);
        await _pendingRepo.CancelAllForAppRegistrationAsync(id);

        return NoContent();
    }
}

public sealed record CreateDeviceRequest(string Name, string DeviceType);
