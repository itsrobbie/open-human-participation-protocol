using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Infrastructure.DotNet.Notifications;
using OHPP.Presentation.Api.Filters;
using OHPP.Services.Participation;

namespace OHPP.Presentation.Api.Controllers;

[Route("api/devices/me")]
[RequireTokenType(TokenType.Device)]
public sealed class DeviceController : OhppControllerBase
{
    private readonly IDeviceTokenRepository _deviceRepo;
    private readonly IPendingRequestRepository _pendingRepo;
    private readonly IAttestationProcessingService _attestationService;
    private readonly SseNotificationChannel _sseChannel;

    public DeviceController(
        IDeviceTokenRepository deviceRepo,
        IPendingRequestRepository pendingRepo,
        IAttestationProcessingService attestationService,
        SseNotificationChannel sseChannel)
    {
        _deviceRepo = deviceRepo;
        _pendingRepo = pendingRepo;
        _attestationService = attestationService;
        _sseChannel = sseChannel;
    }

    [HttpPost("keys", Name = "RegisterDeviceKey")]
    public async Task<IActionResult> RegisterKey([FromBody] RegisterKeyRequest request)
    {
        var device = await _deviceRepo.GetByIdAsync(Principal!.DeviceId!.Value);
        if (device is null)
            return NotFound();

        device.PublicKey = request.PublicKey;
        device.KeyAlgorithm = request.Algorithm;
        await _deviceRepo.UpdateAsync(device);

        return Ok(new { deviceId = device.Id, keyRegistered = true });
    }

    [HttpGet("events", Name = "SubscribeDeviceEvents")]
    public async Task Events(CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["Connection"] = "keep-alive";

        var deviceId = Principal!.DeviceId!.Value;
        var connection = new SseConnection(deviceId, Response.Body);
        _sseChannel.AddConnection(UserId, connection);

        // Flush headers so the client receives the 200 and starts reading the stream
        await Response.Body.FlushAsync(cancellationToken);

        try
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected
        }
        finally
        {
            _sseChannel.RemoveConnection(UserId, connection);
        }
    }

    [HttpGet("pending", Name = "GetDevicePendingRequests")]
    [ProducesResponseType(typeof(DeviceParticipationRequest[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending()
    {
        var requests = await _pendingRepo.GetPendingByUserIdAsync(UserId);
        return Ok(requests.Select(DeviceParticipationRequestMapper.Map).ToList());
    }

    [HttpPost("attestations", Name = "SubmitDeviceAttestation")]
    public async Task<IActionResult> SubmitAttestation([FromBody] SubmitAttestationRequest request)
    {
        var result = await _attestationService.ProcessDeviceAttestationAsync(
            Principal!.DeviceId!.Value,
            UserId,
            request.RequestId.ToString(),
            request.AttestationPayload,
            request.DeviceSignature);

        if (result.IsFailure)
        {
            return result.Error!.Code switch
            {
                "CONFLICT" => Conflict(new { error = result.Error }),
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "UNAUTHORIZED" => Unauthorized(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(new { attestation = result.Value });
    }
}

public sealed record RegisterKeyRequest(string PublicKey, string Algorithm);
public sealed record SubmitAttestationRequest(Guid RequestId, string AttestationPayload, string DeviceSignature);
