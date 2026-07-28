using FluentAssertions;
using OHPP.Protocol.Models;
using OHPP.Protocol.Validation;
using Xunit;

namespace OHPP.Protocol.Tests.Unit;

public sealed class ValidationTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);

    private static ParticipationRequest CreateValid(
        string? id = null,
        string? version = null,
        string? appId = null,
        string? userId = null,
        ActionInfo? action = null,
        RequestType? type = null,
        IReadOnlyList<RequestOption>? options = null,
        DateTimeOffset? expiry = null) => new()
    {
        Id = id ?? Guid.NewGuid().ToString("N"),
        Version = version ?? ProtocolConstants.Version,
        Requester = new RequesterInfo { AppId = appId ?? "bank.example.com" },
        Validation = new ValidationInfo { UserId = userId ?? "user-123" },
        Action = action ?? new ActionInfo { Summary = "Confirm transfer" },
        Type = type ?? RequestType.Select,
        Options = options ?? new List<RequestOption>
        {
            new() { Key = "yes", Label = "Yes" },
            new() { Key = "no", Label = "No" }
        },
        Expiry = expiry ?? Now.AddMinutes(5),
        CreatedAt = Now
    };

    [Fact]
    public void RequestValidator_ValidInput_Accepts()
    {
        var request = CreateValid();
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().BeEmpty();
    }

    [Fact]
    public void RequestValidator_MissingId_Rejects()
    {
        var request = CreateValid(id: "");
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("id"));
    }

    [Fact]
    public void RequestValidator_SummaryTooLong_Rejects()
    {
        var request = CreateValid(
            action: new ActionInfo { Summary = new string('x', ProtocolConstants.MaxLengths.Summary + 1) });
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("summary"));
    }

    [Fact]
    public void RequestValidator_SelectWithNoOptions_Rejects()
    {
        var request = CreateValid(options: Array.Empty<RequestOption>());
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("options"));
    }

    [Fact]
    public void RequestValidator_SelectWithOneOption_Rejects()
    {
        var request = CreateValid(
            options: new List<RequestOption> { new() { Key = "a", Label = "A" } });
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("options") && e.Contains("at least"));
    }

    [Fact]
    public void RequestValidator_TextWithOptions_Rejects()
    {
        var request = CreateValid(
            type: RequestType.Text,
            options: new List<RequestOption>
            {
                new() { Key = "a", Label = "A" },
                new() { Key = "b", Label = "B" }
            });
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("options") && e.Contains("null or empty"));
    }

    [Fact]
    public void RequestValidator_DuplicateOptionKeys_Rejects()
    {
        var request = CreateValid(
            options: new List<RequestOption>
            {
                new() { Key = "dup", Label = "First" },
                new() { Key = "dup", Label = "Second" }
            });
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("unique") && e.Contains("dup"));
    }

    [Fact]
    public void RequestValidator_ExpiredExpiry_Rejects()
    {
        var request = CreateValid(expiry: Now.AddMinutes(-1));
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("expiry") && e.Contains("future"));
    }

    [Fact]
    public void RequestValidator_NullExpiry_Accepts()
    {
        // Need to pass a sentinel to distinguish "use null" from "use default"
        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "bank.example.com" },
            Validation = new ValidationInfo { UserId = "user-123" },
            Action = new ActionInfo { Summary = "Transfer" },
            Type = RequestType.Select,
            Options = new List<RequestOption>
            {
                new() { Key = "yes", Label = "Yes" },
                new() { Key = "no", Label = "No" }
            },
            Expiry = null,
            CreatedAt = Now
        };
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().BeEmpty();
    }

    [Fact]
    public void RequestValidator_DescriptionTooLong_Rejects()
    {
        var request = CreateValid(
            action: new ActionInfo
            {
                Summary = "Valid",
                Description = new string('x', ProtocolConstants.MaxLengths.Description + 1)
            });
        var errors = ParticipationRequestValidator.Validate(request, Now);
        errors.Should().Contain(e => e.Contains("description"));
    }
}
