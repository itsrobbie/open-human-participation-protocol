using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using OHPP.Domain.Auth;
using OHPP.Domain.Attestation;
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
    private readonly ICounterSigningService _counterSigningService;
    private readonly IClock _clock;

    public PortalController(
        IUserRepository userRepo,
        IDeviceTokenRepository deviceRepo,
        IAppRegistrationRepository appRepo,
        IPendingRequestRepository pendingRepo,
        IParticipationRecordRepository recordRepo,
        ITokenGenerator tokenGenerator,
        ICounterSigningService counterSigningService,
        IClock clock)
    {
        _userRepo = userRepo;
        _deviceRepo = deviceRepo;
        _appRepo = appRepo;
        _pendingRepo = pendingRepo;
        _recordRepo = recordRepo;
        _tokenGenerator = tokenGenerator;
        _counterSigningService = counterSigningService;
        _clock = clock;
    }

    // --- User Profile ---

    [HttpPost("users/me", Name = "CreateOrGetProfile")]
    public async Task<IActionResult> CreateOrGetProfile()
    {
        // User is already created/updated during token resolution in AuthenticationService.
        // This endpoint returns the current user record.
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user is null)
            return NotFound();

        return Ok(user);
    }

    [HttpGet("users/me/summary", Name = "GetUserSummary")]
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

    [HttpGet("history", Name = "GetParticipationHistory")]
    public async Task<IActionResult> GetHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _recordRepo.GetByUserIdAsync(UserId, page, pageSize);
        return Ok(result);
    }

    [HttpGet("history/{id:guid}", Name = "GetParticipationHistoryDetail")]
    public async Task<IActionResult> GetHistoryDetail(Guid id)
    {
        var record = await _recordRepo.GetByRequestIdAsync(id);
        if (record is null || record.UserId != UserId)
            return NotFound();

        return Ok(record);
    }

    // --- Devices ---

    [HttpGet("devices", Name = "GetUserDevices")]
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

    [HttpPost("devices", Name = "CreateDevice")]
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

    [HttpDelete("devices/{id:guid}", Name = "RevokeDevice")]
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

    [HttpGet("registrations/apps", Name = "GetRegisteredApps")]
    public async Task<IActionResult> GetRegisteredApps()
    {
        var apps = await _appRepo.GetByUserIdAsync(UserId);
        return Ok(apps.Select(a => new
        {
            a.Id, a.AppId, a.AppName, a.AppIcon,
            a.RegisteredAt, a.RevokedAt, a.IsActive
        }));
    }

    [HttpDelete("registrations/apps/{id:guid}", Name = "RevokeRegisteredApp")]
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

    // --- Web Approvals (fallback — only available when no devices with keys exist) ---

    [HttpGet("web-approvals/status", Name = "GetWebApprovalsStatus")]
    public async Task<IActionResult> GetWebApprovalsStatus()
    {
        var enabled = !await HasActiveDeviceWithKeyAsync();
        return Ok(new
        {
            enabled,
            reason = enabled ? (string?)null : "Disabled — you have a registered device with a key"
        });
    }

    [HttpGet("web-approvals/pending", Name = "GetWebApprovalsPending")]
    public async Task<IActionResult> GetWebPending()
    {
        if (await HasActiveDeviceWithKeyAsync())
            return StatusCode(403, new { error = "Web approvals are disabled when you have registered devices" });

        var pending = await _pendingRepo.GetPendingByUserIdAsync(UserId);

        // Deserialise RequestPayload to expose full request details to the portal
        var enriched = pending.Select(p =>
        {
            var payload = TryParseRequestPayload(p.RequestPayload);
            return new
            {
                p.Id,
                p.AppId,
                actionSummary = p.ActionSummary,
                description = payload?.Description,
                rationale = payload?.Rationale,
                type = p.Type.ToLowerInvariant(),
                options = payload?.Options,
                placeholder = payload?.Placeholder,
                masked = payload?.Masked ?? false,
                keyboard = payload?.Keyboard,
                expiresAt = p.ExpiresAt,
                createdAt = p.CreatedAt,
            };
        });

        return Ok(enriched);
    }

    [HttpPost("web-approvals/{requestId:guid}/resolve", Name = "ResolveWebApproval")]
    public async Task<IActionResult> WebResolve(Guid requestId, [FromBody] WebResolveRequest request)
    {
        if (await HasActiveDeviceWithKeyAsync())
            return StatusCode(403, new { error = "Web approvals are disabled when you have registered devices" });

        var pending = await _pendingRepo.GetByIdAsync(requestId);
        if (pending is null || pending.UserId != UserId)
            return NotFound();

        if (pending.Status != "Pending")
            return Conflict(new { error = $"Request is already {pending.Status}" });

        // Validate the response against the request's options (for Select/Multiselect)
        var validationError = ValidateWebResponse(request, pending);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        // Build decision payload matching the protocol's attestation structure
        var now = _clock.UtcNow;
        var decisionPayload = JsonSerializer.Serialize(new
        {
            requestId = pending.Id.ToString(),
            selectedOption = request.SelectedOption,
            selectedOptions = request.SelectedOptions,
            value = request.Value,
            method = "WebApproval",
            decisionTimestamp = now.ToString("o")
        });
        var attestationResult = await _counterSigningService.CounterSignAsync(
            decisionPayload,
            "identity-provider-authenticated",
            $"web:{UserId}");
        if (attestationResult.IsFailure)
            return StatusCode(503, new { error = "Could not create the participation attestation" });

        // Always "Resolved" — the resolver does not interpret the answer semantically.
        // The requesting app reads the decision payload to determine what the user chose.
        pending.Status = "Resolved";
        pending.ResolvedAt = now;
        await _pendingRepo.UpdateStatusAsync(pending.Id, "Resolved", now);

        var record = new ParticipationRecord
        {
            Id = Guid.NewGuid(),
            RequestId = pending.Id,
            UserId = UserId,
            AppRegistrationId = pending.AppRegistrationId,
            Status = "Resolved",
            AppId = pending.AppId,
            AppName = pending.AppId,
            ActionSummary = pending.ActionSummary,
            Type = pending.Type,
            DecisionPayload = decisionPayload,
            AttestationPayload = attestationResult.Value,
            ResolutionMethod = "WebApproval",
            CreatedAt = pending.CreatedAt,
            ResolvedAt = now
        };
        await _recordRepo.CreateAsync(record);

        return Ok(new { status = "resolved", selectedOption = request.SelectedOption, value = request.Value });
    }

    private static string? ValidateWebResponse(WebResolveRequest request, PendingRequest pending)
    {
        var type = pending.Type.ToLowerInvariant();

        if (type is "select")
        {
            if (string.IsNullOrWhiteSpace(request.SelectedOption))
                return "selectedOption is required for Select type requests";

            // Validate against the request's options
            var payload = TryParseRequestPayload(pending.RequestPayload);
            if (payload?.Options is { Count: > 0 })
            {
                var validKeys = payload.Options.Select(o => o.Key).ToList();
                if (!validKeys.Contains(request.SelectedOption))
                    return $"'{request.SelectedOption}' is not a valid option. Valid options: {string.Join(", ", validKeys)}";
            }
        }
        else if (type is "multiselect")
        {
            if (request.SelectedOptions is null || request.SelectedOptions.Count == 0)
                return "selectedOptions is required for Multiselect type requests";
        }
        else if (type is "text" or "number" or "date" or "datetime")
        {
            if (string.IsNullOrWhiteSpace(request.Value))
                return "value is required for this request type";
        }
        // Signature type just requires submission (acknowledgement)

        return null;
    }

    private static ParsedRequestPayload? TryParseRequestPayload(string requestPayloadJson)
    {
        try
        {
            return JsonSerializer.Deserialize<ParsedRequestPayload>(requestPayloadJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch
        {
            return null;
        }
    }

    private async Task<bool> HasActiveDeviceWithKeyAsync()
    {
        var devices = await _deviceRepo.GetActiveByUserIdAsync(UserId);
        return devices.Any(d => d.PublicKey is not null);
    }
}

public sealed record CreateDeviceRequest(string Name, string DeviceType);

public sealed record WebResolveRequest(
    string? SelectedOption,
    IReadOnlyList<string>? SelectedOptions,
    string? Value
);

/// <summary>
/// Lightweight DTO for deserialising the stored RequestPayload JSON to expose to the portal.
/// Matches the ParticipationRequest structure from the SDK.
/// </summary>
internal sealed class ParsedRequestPayload
{
    public ParsedActionInfo? Action { get; set; }
    public string? Placeholder { get; set; }
    public bool Masked { get; set; }
    public string? Keyboard { get; set; }
    public IReadOnlyList<ParsedRequestOption>? Options { get; set; }

    // Convenience accessors for the enriched response
    public string? Description => Action?.Description;
    public string? Rationale => Action?.Rationale;
}

internal sealed class ParsedActionInfo
{
    public string? Summary { get; set; }
    public string? Description { get; set; }
    public string? Rationale { get; set; }
    public string? Category { get; set; }
}

internal sealed class ParsedRequestOption
{
    public required string Key { get; set; }
    public required string Label { get; set; }
}
