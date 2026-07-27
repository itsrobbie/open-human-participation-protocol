using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Presentation.Api.Filters;
using OHPP.Protocol;

namespace OHPP.Presentation.Api.Controllers;

/// <summary>
/// Handles OHPP protocol endpoints: metadata discovery, JWKS, participation requests.
/// Routes are absolute (start with /) because they span multiple URL prefixes.
/// </summary>
[Route("")]
public sealed class ProtocolController : OhppControllerBase
{
    private readonly IParticipationRequestService _participationService;
    private readonly IRequestLifecycleManager _lifecycleManager;
    private readonly IJwksService _jwksService;
    private readonly IConfiguration _config;

    public ProtocolController(
        IParticipationRequestService participationService,
        IRequestLifecycleManager lifecycleManager,
        IJwksService jwksService,
        IConfiguration config)
    {
        _participationService = participationService;
        _lifecycleManager = lifecycleManager;
        _jwksService = jwksService;
        _config = config;
    }

    [HttpGet("/.well-known/ohpp/metadata")]
    public IActionResult GetMetadata()
    {
        var baseUrl = _config["Resolver:BaseUrl"] ?? "http://localhost:5000";

        return Ok(new
        {
            protocolVersion = new { min = ProtocolConstants.Version, max = ProtocolConstants.Version },
            resolverName = _config["Resolver:Name"] ?? "OHPP Resolver",
            endpoints = new
            {
                participate = $"{baseUrl}/api/participate",
                cancel = $"{baseUrl}/api/participate/{{requestId}}/cancel",
                status = $"{baseUrl}/api/participate/{{requestId}}/status",
                jwks = $"{baseUrl}/.well-known/ohpp/keys"
            }
        });
    }

    [HttpGet("/.well-known/ohpp/keys")]
    public async Task<IActionResult> GetJwks()
    {
        var keys = await _jwksService.GetAllPublicKeysAsync();
        return Ok(new { keys });
    }

    [HttpPost("api/participate")]
    [RequireTokenType(TokenType.AppAccess)]
    public async Task<IActionResult> SubmitRequest([FromBody] SubmitParticipationRequest request)
    {
        var result = await _participationService.SubmitRequestAsync(
            Principal!.AppRegistrationId!.Value,
            UserId,
            Principal.AppId!,
            request.Payload);

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Created($"/api/participate/{result.Value!.Id}/status", new { requestId = result.Value.Id });
    }

    [HttpGet("api/participate/{requestId:guid}/status")]
    [RequireTokenType(TokenType.AppAccess)]
    public async Task<IActionResult> GetStatus(Guid requestId)
    {
        var result = await _lifecycleManager.GetStatusAsync(requestId, Principal!.AppRegistrationId!.Value);

        if (result.IsFailure)
            return NotFound(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("api/participate/{requestId:guid}/cancel")]
    [RequireTokenType(TokenType.AppAccess)]
    public async Task<IActionResult> CancelRequest(Guid requestId)
    {
        var result = await _lifecycleManager.CancelRequestAsync(requestId, Principal!.AppRegistrationId!.Value);

        if (result.IsFailure)
            return Conflict(new { error = result.Error });

        return Ok(new { status = "cancelled" });
    }
}

public sealed record SubmitParticipationRequest(string Payload);
