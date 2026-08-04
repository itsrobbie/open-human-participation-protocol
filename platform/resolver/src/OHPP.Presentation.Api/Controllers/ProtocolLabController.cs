using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Registration;
using OHPP.Presentation.Api.Filters;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using OHPP.Sdk;

namespace OHPP.Presentation.Api.Controllers;

/// <summary>
/// Protocol Lab: a self-contained Requester app hosted inside the Resolver process (dev-only).
/// It registers itself with the Resolver through the real ceremony, receives its own token,
/// and sends requests under its own identity (protocol-lab.dev.test). No impersonation.
/// </summary>
[Route("api/protocol-lab")]
public sealed class ProtocolLabController : OhppControllerBase
{
    private readonly IRegistrationCeremonyOrchestrator _ceremony;
    private readonly IOhppRequesterClient _requester;
    private readonly IConfiguration _configuration;

    /// <summary>
    /// Per-user access tokens received via the registration callback.
    /// Key: userId (Guid), Value: access token string.
    /// </summary>
    internal static readonly ConcurrentDictionary<Guid, LabRegistration> Registrations = new();

    private const string LabAppId = "protocol-lab.dev.test";
    private const string LabAppName = "Protocol Lab";
    private const string LabCallbackPath = "/api/protocol-lab/callback";

    public ProtocolLabController(
        IRegistrationCeremonyOrchestrator ceremony,
        IOhppRequesterClient requester,
        IConfiguration configuration)
    {
        _ceremony = ceremony;
        _requester = requester;
        _configuration = configuration;
    }

    /// <summary>
    /// Serves app-metadata for the Protocol Lab so the registration ceremony can fetch it.
    /// This is NOT behind auth - the Resolver's metadata fetcher calls it during the ceremony.
    /// The Resolver's own metadata is at /.well-known/ohpp/metadata (service metadata),
    /// so there's no collision with this app-metadata path.
    /// </summary>
    [HttpGet("/.well-known/ohpp/app-metadata", Name = "GetLabAppMetadata")]
    [AllowAnonymous]
    public IActionResult GetAppMetadata()
    {
        return Ok(new
        {
            appId = LabAppId,
            name = LabAppName,
            version = "1.0",
            endpoints = new { registrationCallback = LabCallbackPath }
        });
    }

    /// <summary>
    /// Registration callback - receives the access token from the Resolver's ceremony.
    /// This is NOT behind auth - the Resolver's callback sender calls it.
    /// </summary>
    [HttpPost("callback", Name = "ReceiveLabRegistrationCallback")]
    [AllowAnonymous]
    public IActionResult Callback([FromBody] LabCallbackPayload payload)
    {
        if (string.IsNullOrEmpty(payload.AccessToken) || string.IsNullOrEmpty(payload.UserId))
            return BadRequest(new { error = "Missing accessToken or userId" });

        if (!Guid.TryParse(payload.UserId, out var userId))
            return BadRequest(new { error = "Invalid userId" });

        Registrations[userId] = new LabRegistration(
            payload.AccessToken,
            payload.ResolverBaseUrl ?? string.Empty,
            payload.RegistrationId ?? string.Empty,
            DateTimeOffset.UtcNow);

        return Ok();
    }

    /// <summary>
    /// Registers the Protocol Lab as a Requester app with the Resolver using the real ceremony.
    /// The user clicks "Register Protocol Lab" in the Portal and this generates a challenge,
    /// submits it to the ceremony orchestrator, which fetches our app-metadata, validates it,
    /// sends a callback to our callback endpoint, and we store the token.
    /// </summary>
    [HttpPost("register", Name = "RegisterProtocolLab")]
    [RequireTokenType(OHPP.Domain.Auth.TokenType.IdentityProvider)]
    public async Task<IActionResult> Register(CancellationToken cancellationToken)
    {
        // Generate a challenge as the Lab app
        var challenge = new RegistrationChallenge
        {
            ChallengeId = Guid.NewGuid().ToString("N"),
            RequesterAppId = LabAppId,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow
        };

        var encoded = ChallengeGenerator.EncodeChallenge(challenge);

        // Submit the challenge to the Resolver's own registration ceremony
        var result = await _ceremony.ProcessChallengeAsync(UserId, encoded, cancellationToken);

        if (result.IsFailure)
            return BadRequest(new { error = result.Error!.Message });

        // Verify we received the token via the callback
        if (!Registrations.TryGetValue(UserId, out var registration))
            return StatusCode(500, new { error = "Registration ceremony completed but callback was not received" });

        return Ok(new { registered = true, appId = LabAppId });
    }

    /// <summary>
    /// Returns the current Lab registration status for the signed-in user.
    /// </summary>
    [HttpGet("status", Name = "GetProtocolLabStatus")]
    [RequireTokenType(OHPP.Domain.Auth.TokenType.IdentityProvider)]
    public IActionResult GetLabStatus()
    {
        var isRegistered = Registrations.ContainsKey(UserId);
        return Ok(new { registered = isRegistered, appId = LabAppId });
    }

    /// <summary>
    /// Sends a participation request through the protocol using the Lab's own access token.
    /// No impersonation - the Lab IS the Requester app.
    /// </summary>
    [HttpPost("requests", Name = "SendLabRequest")]
    [RequireTokenType(OHPP.Domain.Auth.TokenType.IdentityProvider)]
    public async Task<IActionResult> Send([FromBody] SendLabRequest request, CancellationToken cancellationToken)
    {
        if (!Registrations.TryGetValue(UserId, out var registration))
            return BadRequest(new { error = "Protocol Lab is not registered. Click 'Register Protocol Lab' first." });

        ParticipationRequest? payload;
        try
        {
            payload = OhppJsonSerialiser.Deserialise<ParticipationRequest>(request.Payload);
        }
        catch
        {
            return BadRequest(new { error = "Payload is not valid protocol JSON" });
        }

        if (payload is null)
            return BadRequest(new { error = "Payload is required" });

        if (!string.Equals(payload.Requester.AppId, LabAppId, StringComparison.Ordinal))
            return BadRequest(new { error = $"requester.appId must be '{LabAppId}'" });

        if (!string.Equals(payload.Validation.UserId, UserId.ToString(), StringComparison.Ordinal))
            return BadRequest(new { error = "validation.userId must match the signed-in portal user" });

        var resolverUrl = _configuration["Resolver:InternalBaseUrl"] ?? registration.ResolverBaseUrl;
        var result = await _requester.SendRequestAsync(payload, resolverUrl, registration.AccessToken, cancellationToken);
        if (!result.Success)
            return StatusCode(result.HttpStatusCode ?? 400, new { error = result.Error });

        return Ok(new { requestId = result.RequestId, status = "pending" });
    }

    /// <summary>
    /// Polls the status of a request sent by the Lab using the Lab's own token.
    /// </summary>
    [HttpGet("requests/{requestId:guid}/status", Name = "GetLabRequestStatus")]
    [RequireTokenType(OHPP.Domain.Auth.TokenType.IdentityProvider)]
    public async Task<IActionResult> GetStatus(Guid requestId, CancellationToken cancellationToken)
    {
        if (!Registrations.TryGetValue(UserId, out var registration))
            return BadRequest(new { error = "Protocol Lab is not registered" });

        var resolverUrl = _configuration["Resolver:InternalBaseUrl"] ?? registration.ResolverBaseUrl;
        var result = await _requester.GetStatusAsync(requestId.ToString(), resolverUrl, registration.AccessToken, cancellationToken);
        if (!result.Success)
            return StatusCode(result.HttpStatusCode ?? 400, new { error = result.Error });

        System.Text.Json.JsonElement? protocolAttestation = result.Attestation is null
            ? null
            : System.Text.Json.JsonDocument.Parse(OhppJsonSerialiser.Serialise(result.Attestation)).RootElement.Clone();

        return Ok(new
        {
            status = result.Status?.ToString().ToLowerInvariant(),
            selectedOption = result.SelectedOption,
            selectedOptions = result.SelectedOptions,
            value = result.Value,
            attestation = protocolAttestation
        });
    }
}

public sealed record SendLabRequest(string Payload);

public sealed record LabCallbackPayload(
    string? ChallengeId,
    string? ResolverBaseUrl,
    string? UserId,
    string? AccessToken,
    string? RegistrationId,
    string? CreatedAt);

public sealed record LabRegistration(
    string AccessToken,
    string ResolverBaseUrl,
    string RegistrationId,
    DateTimeOffset RegisteredAt);
