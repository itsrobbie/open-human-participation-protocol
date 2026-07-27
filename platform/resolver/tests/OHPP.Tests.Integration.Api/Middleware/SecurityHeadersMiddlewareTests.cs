using FluentAssertions;
using Microsoft.AspNetCore.Http;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class SecurityHeadersMiddlewareTests
{
    [Fact]
    public async Task SetsAllSecurityHeaders()
    {
        var context = new DefaultHttpContext();

        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);
        await middleware.InvokeAsync(context);

        context.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        context.Response.Headers["X-Frame-Options"].ToString().Should().Be("DENY");
        context.Response.Headers["X-XSS-Protection"].ToString().Should().Be("0");
        context.Response.Headers["Referrer-Policy"].ToString().Should().Be("strict-origin-when-cross-origin");
        context.Response.Headers["Cache-Control"].ToString().Should().Be("no-store");
        context.Response.Headers["Pragma"].ToString().Should().Be("no-cache");
    }

    [Fact]
    public async Task CallsNextMiddleware()
    {
        var context = new DefaultHttpContext();
        var nextCalled = false;

        var middleware = new SecurityHeadersMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }
}
