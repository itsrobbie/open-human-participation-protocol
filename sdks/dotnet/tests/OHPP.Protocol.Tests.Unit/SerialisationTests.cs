using FluentAssertions;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Protocol.Tests.Unit;

public sealed class SerialisationTests
{
    [Fact]
    public void PublicConstantsAndSerializerOptions_MatchProtocolContract()
    {
        ProtocolConstants.Version.Should().Be("1.0");
        ProtocolConstants.UriScheme.Should().Be("ohpp");
        ProtocolConstants.WellKnownMetadataPath.Should().Be("/.well-known/ohpp/metadata");
        OhppJsonSerialiser.GetOptions().PropertyNamingPolicy.Should().NotBeNull();
    }

    [Fact]
    public void CanonicalJson_DeterministicOutput_ForSigning()
    {
        var request = new ParticipationRequest
        {
            Id = "abc123",
            Version = "1.0",
            Requester = new RequesterInfo { AppId = "app.test" },
            Validation = new ValidationInfo { UserId = "user-1" },
            Action = new ActionInfo { Summary = "Test action" },
            Type = RequestType.Text,
            CreatedAt = new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var json1 = OhppJsonSerialiser.SerialiseCanonical(request);
        var json2 = OhppJsonSerialiser.SerialiseCanonical(request);

        json1.Should().Be(json2);
        json1.Should().NotContain("\n"); // Must be minified
        json1.Should().NotContain("  "); // No indentation
    }

    [Fact]
    public void Serialise_NullFieldsOmitted()
    {
        var request = new ParticipationRequest
        {
            Id = "abc123",
            Version = "1.0",
            Requester = new RequesterInfo { AppId = "app.test" },
            Validation = new ValidationInfo { UserId = "user-1" },
            Action = new ActionInfo { Summary = "Test" },
            Type = RequestType.Text,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(request);

        json.Should().NotContain("\"options\"");
        json.Should().NotContain("\"transaction\"");
        json.Should().NotContain("\"placeholder\"");
        json.Should().NotContain("\"keyboard\"");
    }

    [Fact]
    public void Serialise_EnumsAreCamelCase()
    {
        var request = new ParticipationRequest
        {
            Id = "abc",
            Version = "1.0",
            Requester = new RequesterInfo { AppId = "app.test" },
            Validation = new ValidationInfo { UserId = "user-1" },
            Action = new ActionInfo { Summary = "Test" },
            Type = RequestType.Select,
            Options = new List<RequestOption>
            {
                new() { Key = "a", Label = "A" },
                new() { Key = "b", Label = "B" }
            },
            CreatedAt = DateTimeOffset.UtcNow
        };

        var json = OhppJsonSerialiser.Serialise(request);

        json.Should().Contain("\"select\"");
    }
}
