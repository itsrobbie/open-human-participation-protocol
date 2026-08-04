using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class ProtocolLabAvailabilityMiddlewareTests
{
    [Fact]
    public async Task ProtocolLabAvailability_DevelopmentFlagEnabled_ReturnsSuccess()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(enabled: true, () => nextCalled = true);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/protocol-lab/requests";

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task ProtocolLabAvailability_DevelopmentFlagDisabled_ReturnsNotFound()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(enabled: false, () => nextCalled = true);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/protocol-lab/requests/00000000-0000-0000-0000-000000000000/status";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        nextCalled.Should().BeFalse();
    }

    [Fact]
    public async Task ProtocolLabAvailability_AppMetadata_DisabledReturnsNotFound()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(enabled: false, () => nextCalled = true);
        var context = new DefaultHttpContext();
        context.Request.Path = "/.well-known/ohpp/app-metadata";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        nextCalled.Should().BeFalse();
    }

    [Fact]
    public async Task ProtocolLabAvailability_AppMetadata_EnabledAllowsThrough()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(enabled: true, () => nextCalled = true);
        var context = new DefaultHttpContext();
        context.Request.Path = "/.well-known/ohpp/app-metadata";

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }

    private static ProtocolLabAvailabilityMiddleware CreateMiddleware(bool enabled, Action onNext)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Features:ProtocolLab"] = enabled.ToString() })
            .Build();
        return new ProtocolLabAvailabilityMiddleware(_ =>
        {
            onNext();
            return Task.CompletedTask;
        }, configuration);
    }
}
