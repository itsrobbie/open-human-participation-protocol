using FsCheck;
using FsCheck.Xunit;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using OHPP.Protocol.Validation;

namespace OHPP.Protocol.Tests.Unit;

public sealed class PropertyTests
{
    [Property]
    public bool PBT_ParticipationRequest_SerialiseDeserialise_Identity(byte variant)
    {
        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = "1.0",
            Requester = new RequesterInfo { AppId = $"app{variant}.test" },
            Validation = new ValidationInfo { UserId = $"user-{variant}" },
            Action = new ActionInfo { Summary = $"Action {variant}" },
            Type = RequestType.Text,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(request);
        var result = OhppJsonSerialiser.Deserialise<ParticipationRequest>(json);

        return result is not null
            && result.Id == request.Id
            && result.Requester.AppId == request.Requester.AppId
            && result.Validation.UserId == request.Validation.UserId;
    }

    [Property]
    public bool PBT_Attestation_SerialiseDeserialise_Identity(byte variant)
    {
        var attestation = new ParticipationAttestation
        {
            Id = Guid.NewGuid().ToString("N"),
            RequestId = Guid.NewGuid().ToString("N"),
            Version = "1.0",
            Decision = new DecisionInfo
            {
                SelectedOption = $"option-{variant}",
                Timestamp = DateTimeOffset.UtcNow
            },
            Resolution = new ResolutionInfo
            {
                Method = ResolutionMethod.Direct,
                Endpoint = new EndpointInfo { Type = "device", Id = $"dev-{variant}" }
            },
            Signature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = Convert.ToBase64String(new byte[64]),
                KeyId = $"key-{variant}"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(attestation);
        var result = OhppJsonSerialiser.Deserialise<ParticipationAttestation>(json);

        return result is not null
            && result.Id == attestation.Id
            && result.RequestId == attestation.RequestId
            && result.Decision.SelectedOption == attestation.Decision.SelectedOption;
    }

    [Property]
    public bool PBT_AttestationEnvelope_SerialiseDeserialise_Identity(byte variant)
    {
        var envelope = new AttestationEnvelope
        {
            InnerAttestation = new ParticipationAttestation
            {
                Id = $"att-{variant}",
                RequestId = $"req-{variant}",
                Version = "1.0",
                Decision = new DecisionInfo { Timestamp = DateTimeOffset.UtcNow },
                Resolution = new ResolutionInfo
                {
                    Method = ResolutionMethod.Direct,
                    Endpoint = new EndpointInfo { Type = "device", Id = "d1" }
                },
                Signature = new SignatureInfo
                {
                    Algorithm = SignatureAlgorithm.ES256,
                    Value = "inner-sig",
                    KeyId = "key-inner"
                },
                IssuedAt = DateTimeOffset.UtcNow
            },
            OuterSignature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = "outer-sig",
                KeyId = "key-outer"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(envelope);
        var result = OhppJsonSerialiser.Deserialise<AttestationEnvelope>(json);

        return result is not null
            && result.InnerAttestation.Id == envelope.InnerAttestation.Id
            && result.OuterSignature.KeyId == envelope.OuterSignature.KeyId;
    }

    [Property]
    public bool PBT_RegistrationChallenge_SerialiseDeserialise_Identity(byte variant)
    {
        var challenge = new RegistrationChallenge
        {
            ChallengeId = $"ch-{variant}",
            RequesterAppId = $"app{variant}.test",
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(challenge);
        var result = OhppJsonSerialiser.Deserialise<RegistrationChallenge>(json);

        return result is not null
            && result.ChallengeId == challenge.ChallengeId
            && result.RequesterAppId == challenge.RequesterAppId;
    }

    [Property]
    public bool PBT_RequestValidator_AllValidInputs_Accepts(byte variant)
    {
        var now = DateTimeOffset.UtcNow;

        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = "1.0",
            Requester = new RequesterInfo { AppId = $"app{variant}.test" },
            Validation = new ValidationInfo { UserId = $"user-{variant}" },
            Action = new ActionInfo { Summary = $"Action {(variant % 50) + 1}" },
            Type = RequestType.Select,
            Options = new List<RequestOption>
            {
                new() { Key = "opt1", Label = "Option 1" },
                new() { Key = "opt2", Label = "Option 2" }
            },
            Expiry = now.AddHours(1),
            CreatedAt = now
        };

        var errors = ParticipationRequestValidator.Validate(request, now);
        return errors.Count == 0;
    }

    [Property]
    public bool PBT_RequestValidator_AllInvalidInputs_Rejects(byte variant)
    {
        var now = DateTimeOffset.UtcNow;

        // Always-invalid: expired, no options for select, empty summary
        var request = new ParticipationRequest
        {
            Id = "",
            Version = "",
            Requester = new RequesterInfo { AppId = "" },
            Validation = new ValidationInfo { UserId = "" },
            Action = new ActionInfo { Summary = "" },
            Type = RequestType.Select,
            Options = null,
            Expiry = now.AddMinutes(-variant - 1),
            CreatedAt = now
        };

        var errors = ParticipationRequestValidator.Validate(request, now);
        return errors.Count > 0;
    }

    [Property]
    public bool PBT_CanonicalJson_DeterministicOutput(byte variant)
    {
        var request = new ParticipationRequest
        {
            Id = $"req-{variant}",
            Version = "1.0",
            Requester = new RequesterInfo { AppId = "app.test" },
            Validation = new ValidationInfo { UserId = $"user-{variant}" },
            Action = new ActionInfo { Summary = "Test" },
            Type = RequestType.Text,
            CreatedAt = new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var json1 = OhppJsonSerialiser.SerialiseCanonical(request);
        var json2 = OhppJsonSerialiser.SerialiseCanonical(request);

        return json1 == json2 && !json1.Contains('\n');
    }
}
