using FluentAssertions;
using Microsoft.AspNetCore.Http;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task NoCorrelationIdHeader_GeneratesNewId()
    {
        var context = new DefaultHttpContext();
        string? capturedId = null;

        var middleware = new CorrelationIdMiddleware(ctx =>
        {
            capturedId = ctx.Items["CorrelationId"]?.ToString();
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context);

        capturedId.Should().NotBeNullOrEmpty();
        context.Response.Headers["X-Correlation-Id"].ToString().Should().Be(capturedId);
    }

    [Fact]
    public async Task ExistingCorrelationIdHeader_PreservesIt()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = "my-custom-id";
        string? capturedId = null;

        var middleware = new CorrelationIdMiddleware(ctx =>
        {
            capturedId = ctx.Items["CorrelationId"]?.ToString();
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context);

        capturedId.Should().Be("my-custom-id");
        context.Response.Headers["X-Correlation-Id"].ToString().Should().Be("my-custom-id");
    }
}
