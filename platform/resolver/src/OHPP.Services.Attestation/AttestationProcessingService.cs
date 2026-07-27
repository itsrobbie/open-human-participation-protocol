using System.Text.Json;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;

namespace OHPP.Services.Attestation;

public sealed class AttestationProcessingService : IAttestationProcessingService
{
    private const int MaxTextDecisionLength = 5000;

    private readonly IDeviceTokenRepository _deviceRepo;
    private readonly IPendingRequestRepository _pendingRequestRepo;
    private readonly IParticipationRecordRepository _recordRepo;
    private readonly ISignatureVerifier _signatureVerifier;
    private readonly ICounterSigningService _counterSigningService;
    private readonly IClock _clock;

    public AttestationProcessingService(
        IDeviceTokenRepository deviceRepo,
        IPendingRequestRepository pendingRequestRepo,
        IParticipationRecordRepository recordRepo,
        ISignatureVerifier signatureVerifier,
        ICounterSigningService counterSigningService,
        IClock clock)
    {
        _deviceRepo = deviceRepo;
        _pendingRequestRepo = pendingRequestRepo;
        _recordRepo = recordRepo;
        _signatureVerifier = signatureVerifier;
        _counterSigningService = counterSigningService;
        _clock = clock;
    }

    public async Task<Result<string>> ProcessDeviceAttestationAsync(
        Guid deviceId,
        Guid userId,
        string requestId,
        string attestationPayloadJson,
        string deviceSignature,
        CancellationToken cancellationToken = default)
    {
        var device = await _deviceRepo.GetByIdAsync(deviceId, cancellationToken);
        if (device is null)
        {
            return Error.NotFound("Device not found");
        }

        if (string.IsNullOrEmpty(device.PublicKey))
        {
            return Error.Validation("Device has no registered public key", new List<ValidationFailure>
            {
                new() { Field = "deviceId", Message = "Device does not have a public key registered" }
            });
        }

        if (!Guid.TryParse(requestId, out var parsedRequestId))
        {
            return Error.Validation("Invalid request ID format", new List<ValidationFailure>
            {
                new() { Field = "requestId", Message = "Request ID must be a valid GUID" }
            });
        }

        var request = await _pendingRequestRepo.GetByIdAsync(parsedRequestId, cancellationToken);
        if (request is null)
        {
            return Error.NotFound("Request not found");
        }

        if (request.UserId != userId)
        {
            return Error.NotFound("Request not found");
        }

        if (request.Status != "Pending")
        {
            return Error.Conflict($"Request is in '{request.Status}' state and cannot be attested");
        }

        var isSignatureValid = _signatureVerifier.Verify(attestationPayloadJson, deviceSignature, device.PublicKey);
        if (!isSignatureValid)
        {
            return Error.Unauthorized("Device signature verification failed");
        }

        var validationError = ValidateAttestationPayload(attestationPayloadJson, request);
        if (validationError is not null)
        {
            return validationError;
        }

        var counterSignResult = await _counterSigningService.CounterSignAsync(
            attestationPayloadJson, deviceSignature, device.Id.ToString(), cancellationToken);

        if (counterSignResult.IsFailure)
        {
            return counterSignResult.Error!;
        }

        await _pendingRequestRepo.UpdateStatusAsync(parsedRequestId, "Resolved", _clock.UtcNow, cancellationToken);

        await _recordRepo.CreateAsync(new ParticipationRecord
        {
            Id = Guid.NewGuid(),
            RequestId = parsedRequestId,
            UserId = userId,
            AppRegistrationId = request.AppRegistrationId,
            Status = "Resolved",
            AppId = request.AppId,
            AppName = request.AppId,
            ActionSummary = request.ActionSummary,
            Type = request.Type,
            DecisionPayload = attestationPayloadJson,
            AttestationPayload = counterSignResult.Value,
            ResolutionMethod = "Device",
            ResolvingDeviceId = deviceId,
            CreatedAt = request.CreatedAt,
            ResolvedAt = _clock.UtcNow
        }, cancellationToken);

        return counterSignResult.Value!;
    }

    private Error? ValidateAttestationPayload(string attestationPayloadJson, PendingRequest request)
    {
        JsonElement payload;
        try
        {
            payload = JsonSerializer.Deserialize<JsonElement>(attestationPayloadJson);
        }
        catch (JsonException)
        {
            return Error.Validation("Invalid attestation payload JSON", new List<ValidationFailure>
            {
                new() { Field = "attestationPayloadJson", Message = "Payload is not valid JSON" }
            });
        }

        if (payload.TryGetProperty("decisionTimestamp", out var timestampElement))
        {
            if (DateTimeOffset.TryParse(timestampElement.GetString(), out var decisionTimestamp))
            {
                if (decisionTimestamp < request.CreatedAt)
                {
                    return Error.Validation("Decision timestamp is before request creation", new List<ValidationFailure>
                    {
                        new() { Field = "decisionTimestamp", Message = "Decision timestamp cannot be before request creation time" }
                    });
                }

                if (request.ExpiresAt.HasValue && decisionTimestamp > request.ExpiresAt.Value)
                {
                    return Error.Validation("Decision timestamp is after request expiry", new List<ValidationFailure>
                    {
                        new() { Field = "decisionTimestamp", Message = "Decision timestamp cannot be after request expiry time" }
                    });
                }
            }
        }

        if (payload.TryGetProperty("type", out var typeElement))
        {
            var attestationType = typeElement.GetString();

            if (attestationType == "Select" && payload.TryGetProperty("decision", out var decisionElement))
            {
                var selectedOption = decisionElement.GetString();
                if (selectedOption is not null)
                {
                    var validationResult = ValidateSelectOption(selectedOption, request.RequestPayload);
                    if (validationResult is not null)
                    {
                        return validationResult;
                    }
                }
            }

            if (attestationType == "Text" && payload.TryGetProperty("decision", out var textDecisionElement))
            {
                var textValue = textDecisionElement.GetString();
                if (textValue is not null && textValue.Length > MaxTextDecisionLength)
                {
                    return Error.Validation("Text decision exceeds maximum length", new List<ValidationFailure>
                    {
                        new() { Field = "decision", Message = $"Text decision must not exceed {MaxTextDecisionLength} characters" }
                    });
                }
            }
        }

        if (payload.TryGetProperty("method", out var methodElement))
        {
            var method = methodElement.GetString();
            if (method == "Delegated")
            {
                var hasDelegatedTo = payload.TryGetProperty("delegatedTo", out var delegatedToElement) &&
                                     delegatedToElement.ValueKind != JsonValueKind.Null &&
                                     !string.IsNullOrWhiteSpace(delegatedToElement.GetString());

                if (!hasDelegatedTo)
                {
                    return Error.Validation("Delegated method requires delegatedTo field", new List<ValidationFailure>
                    {
                        new() { Field = "delegatedTo", Message = "The 'delegatedTo' field is required when method is 'Delegated'" }
                    });
                }
            }
        }

        return null;
    }

    private static Error? ValidateSelectOption(string selectedOption, string requestPayload)
    {
        try
        {
            var requestData = JsonSerializer.Deserialize<JsonElement>(requestPayload);
            if (requestData.TryGetProperty("options", out var optionsElement) && optionsElement.ValueKind == JsonValueKind.Array)
            {
                var validKeys = new List<string>();
                foreach (var option in optionsElement.EnumerateArray())
                {
                    if (option.TryGetProperty("key", out var keyElement))
                    {
                        var key = keyElement.GetString();
                        if (key is not null)
                        {
                            validKeys.Add(key);
                        }
                    }
                }

                if (validKeys.Count > 0 && !validKeys.Contains(selectedOption))
                {
                    return Error.Validation("Selected option is not in the original request options", new List<ValidationFailure>
                    {
                        new() { Field = "decision", Message = $"Option '{selectedOption}' is not a valid choice" }
                    });
                }
            }
        }
        catch (JsonException)
        {
            // If we can't parse the request payload, skip option validation
        }

        return null;
    }
}
