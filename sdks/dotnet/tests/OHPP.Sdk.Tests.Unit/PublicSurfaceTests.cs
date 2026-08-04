using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using NSubstitute;
using OHPP.Protocol;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class PublicSurfaceTests
{
    [Fact]
    public void AddOhppRequester_RegistersConfiguredPublicServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(Substitute.For<IRegistrationStore>());
        services.AddOhppRequester(options =>
        {
            options.AppId = "requester.test";
            options.AppName = "Requester";
            options.BaseUrl = "https://requester.test";
            options.CallbackPath = "/ohpp/callback";
            options.IconUrl = "https://requester.test/icon.svg";
            options.ProtocolVersion = ProtocolConstants.Version;
            options.HttpTimeoutSeconds = 12;
            options.MetadataCacheDurationSeconds = 34;
        });
        using var provider = services.BuildServiceProvider();

        provider.GetRequiredService<IOhppRequesterClient>().Should().NotBeNull();
        provider.GetRequiredService<EndpointDiscovery>().Should().NotBeNull();
        provider.GetRequiredService<ChallengeGenerator>().Should().NotBeNull();
        provider.GetRequiredService<CallbackHandler>().Should().NotBeNull();
        var options = provider.GetRequiredService<IOptions<OhppRequesterOptions>>().Value;
        options.IconUrl.Should().EndWith("icon.svg");
        options.HttpTimeoutSeconds.Should().Be(12);
        options.MetadataCacheDurationSeconds.Should().Be(34);
    }

    [Fact]
    public void ResultFactories_PreserveSuccessFailureStatusAndTypedValues()
    {
        ParticipationResult.Ok("request-1").RequestId.Should().Be("request-1");
        ParticipationResult.Fail("failed", 422).HttpStatusCode.Should().Be(422);
        RequestStatusResult.Ok(RequestStatus.Resolved, selectedOption: "continue", selectedOptions: ["a", "b"], value: "typed")
            .Should().BeEquivalentTo(new
            {
                Success = true,
                Status = (RequestStatus?)RequestStatus.Resolved,
                SelectedOption = "continue",
                SelectedOptions = new[] { "a", "b" },
                Value = "typed"
            });
        RequestStatusResult.Fail("failed", 404).HttpStatusCode.Should().Be(404);
        CancelResult.Ok().Success.Should().BeTrue();
        CancelResult.Fail("conflict", 409).HttpStatusCode.Should().Be(409);
        VerificationResult.Verified().Valid.Should().BeTrue();
        VerificationResult.Invalid("bad signature").Error.Should().Be("bad signature");
    }
}
