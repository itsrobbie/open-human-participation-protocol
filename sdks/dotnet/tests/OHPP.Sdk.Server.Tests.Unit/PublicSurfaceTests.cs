using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OHPP.Protocol.Models;
using Xunit;

namespace OHPP.Sdk.Server.Tests.Unit;

public sealed class PublicSurfaceTests
{
    [Fact]
    public void AddOhppResolver_RegistersHostImplementationsAndAllOptions()
    {
        var services = new ServiceCollection();
        services.AddOhppResolver<FakeResolverServices, FakeAuthAccessor>(options =>
        {
            options.BaseUrl = "https://resolver.test/";
            options.Name = "Mapped Resolver";
            options.ProtocolVersionMin = "1.0";
            options.ProtocolVersionMax = "1.1";
            options.ParticipatePath = "/participate";
            options.StatusPathTemplate = "/participate/{requestId}/status";
            options.CancelPathTemplate = "/participate/{requestId}/cancel";
            options.JwksPath = "/keys";
            options.FederationEndpoint = "https://federation.test";
        });
        using var provider = services.BuildServiceProvider();

        provider.GetRequiredService<IOhppResolverServices>().Should().BeOfType<FakeResolverServices>();
        provider.GetRequiredService<IOhppAuthContextAccessor>().Should().BeOfType<FakeAuthAccessor>();
        var options = provider.GetRequiredService<IOptions<OhppResolverOptions>>().Value;
        MetadataBuilder.Build(options).Endpoints.Should().BeEquivalentTo(new
        {
            Participate = "https://resolver.test/participate",
            ParticipateStatus = "https://resolver.test/participate/{requestId}/status",
            Keys = "https://resolver.test/keys",
            Federation = "https://federation.test"
        });
    }

    [Fact]
    public void ResolverResultFactories_PreserveValueErrorAndSuggestedStatus()
    {
        ResolverResult<string>.Ok("request-1").Should().BeEquivalentTo(new
        {
            IsSuccess = true,
            Value = "request-1",
            SuggestedStatusCode = 200
        });
        ResolverResult<string>.Fail("conflict", 409).Should().BeEquivalentTo(new
        {
            IsSuccess = false,
            Error = "conflict",
            SuggestedStatusCode = 409
        });
    }

    [Fact]
    public void ServiceRegistration_MissingImplementation_FailsClearly()
    {
        using var provider = new ServiceCollection().BuildServiceProvider();

        var action = () => provider.GetRequiredService<IOhppResolverServices>();

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*IOhppResolverServices*");
    }

    [Fact]
    public void OhppAppAuthContext_ExposesAllIdentityMembers()
    {
        var context = new OhppAppAuthContext
        {
            AppRegistrationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "requester.test"
        };

        context.AppRegistrationId.Should().NotBeEmpty();
        context.UserId.Should().NotBeEmpty();
        context.AppId.Should().Be("requester.test");
    }
}
