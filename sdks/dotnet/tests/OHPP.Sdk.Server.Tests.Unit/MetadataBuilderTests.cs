using FluentAssertions;
using Xunit;

namespace OHPP.Sdk.Server.Tests.Unit;

public sealed class MetadataBuilderTests
{
    [Fact]
    public void MetadataEndpoint_ReturnsCorrectStructure()
    {
        var options = new OhppResolverOptions
        {
            BaseUrl = "https://resolver.example.com",
            Name = "Example Resolver"
        };

        var metadata = MetadataBuilder.Build(options);

        metadata.Name.Should().Be("Example Resolver");
        metadata.ProtocolVersion.Min.Should().Be("1.0");
        metadata.ProtocolVersion.Max.Should().Be("1.0");
        metadata.Endpoints.Participate.Should().Be("https://resolver.example.com/api/participate");
        metadata.Endpoints.ParticipateStatus.Should().Be("https://resolver.example.com/api/participate/{requestId}/status");
        metadata.Endpoints.Keys.Should().Be("https://resolver.example.com/.well-known/ohpp/keys");
        metadata.Endpoints.Federation.Should().BeNull();
    }

    [Fact]
    public void MetadataEndpoint_IncludesProtocolVersionRange()
    {
        var options = new OhppResolverOptions
        {
            BaseUrl = "https://resolver.test",
            ProtocolVersionMin = "1.0",
            ProtocolVersionMax = "1.1"
        };

        var metadata = MetadataBuilder.Build(options);

        metadata.ProtocolVersion.Min.Should().Be("1.0");
        metadata.ProtocolVersion.Max.Should().Be("1.1");
    }

    [Fact]
    public void MetadataEndpoint_TrailingSlashTrimmed()
    {
        var options = new OhppResolverOptions
        {
            BaseUrl = "https://resolver.test/"
        };

        var metadata = MetadataBuilder.Build(options);

        metadata.Endpoints.Participate.Should().StartWith("https://resolver.test/api");
        metadata.Endpoints.Participate.Should().NotContain("//api");
    }

    [Fact]
    public void MetadataEndpoint_IncludesFederationWhenSet()
    {
        var options = new OhppResolverOptions
        {
            BaseUrl = "https://resolver.test",
            FederationEndpoint = "https://resolver.test/api/federation"
        };

        var metadata = MetadataBuilder.Build(options);

        metadata.Endpoints.Federation.Should().Be("https://resolver.test/api/federation");
    }
}
