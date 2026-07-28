using FluentAssertions;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Sdk.Server.Tests.Unit;

public sealed class RequestValidationPipelineTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);

    private static string BuildValidPayload(Action<ParticipationRequest>? mutate = null)
    {
        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "bank.example.com" },
            Validation = new ValidationInfo { UserId = "user-123" },
            Action = new ActionInfo { Summary = "Transfer $500 to John" },
            Type = RequestType.Select,
            Options = new List<RequestOption>
            {
                new() { Key = "confirm", Label = "Confirm" },
                new() { Key = "deny", Label = "Deny" }
            },
            Expiry = Now.AddMinutes(10),
            CreatedAt = Now
        };

        // Can't mutate records easily, but the test validates the pipeline against well-formed JSON
        return OhppJsonSerialiser.Serialise(request);
    }

    [Fact]
    public void RequestValidation_ValidPayload_ReturnsNoErrors()
    {
        var payload = BuildValidPayload();

        var errors = RequestValidationPipeline.Validate(payload, Now);

        errors.Should().BeEmpty();
    }

    [Fact]
    public void RequestValidation_NullPayload_ReturnsError()
    {
        var errors = RequestValidationPipeline.Validate(null, Now);

        errors.Should().ContainSingle()
            .Which.Should().Contain("required");
    }

    [Fact]
    public void RequestValidation_EmptyPayload_ReturnsError()
    {
        var errors = RequestValidationPipeline.Validate("", Now);

        errors.Should().ContainSingle()
            .Which.Should().Contain("required");
    }

    [Fact]
    public void RequestValidation_InvalidJson_ReturnsError()
    {
        var errors = RequestValidationPipeline.Validate("{not valid json", Now);

        errors.Should().ContainSingle()
            .Which.Should().Contain("JSON");
    }

    [Fact]
    public void RequestValidation_InvalidPayload_Returns422Errors()
    {
        // Missing required fields
        var payload = OhppJsonSerialiser.Serialise(new ParticipationRequest
        {
            Id = "",
            Version = "",
            Requester = new RequesterInfo { AppId = "" },
            Validation = new ValidationInfo { UserId = "" },
            Action = new ActionInfo { Summary = "" },
            Type = RequestType.Select,
            Options = null, // Select requires options
            CreatedAt = Now
        });

        var errors = RequestValidationPipeline.Validate(payload, Now);

        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("id"));
    }

    [Fact]
    public void RequestValidation_ExpiredExpiry_ReturnsError()
    {
        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "bank.example.com" },
            Validation = new ValidationInfo { UserId = "user-123" },
            Action = new ActionInfo { Summary = "Transfer" },
            Type = RequestType.Text,
            Expiry = Now.AddMinutes(-5), // Already expired
            CreatedAt = Now.AddMinutes(-10)
        };
        var payload = OhppJsonSerialiser.Serialise(request);

        var errors = RequestValidationPipeline.Validate(payload, Now);

        errors.Should().Contain(e => e.Contains("expiry"));
    }
}
