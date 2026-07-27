using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using NSubstitute;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class GlobalExceptionHandlerTests
{
    [Fact]
    public async Task NoException_ProceedsNormally()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var logger = Substitute.For<ILogger<GlobalExceptionHandler>>();
        var nextCalled = false;

        var middleware = new GlobalExceptionHandler(_ => { nextCalled = true; return Task.CompletedTask; }, logger);
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task UnhandledException_Returns500WithErrorBody()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.Method = "GET";
        context.Request.Path = "/api/test";
        var logger = Substitute.For<ILogger<GlobalExceptionHandler>>();

        var middleware = new GlobalExceptionHandler(_ => throw new InvalidOperationException("boom"), logger);
        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
        context.Response.ContentType.Should().Be("application/json");

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        body.Should().Contain("INTERNAL_ERROR");
        body.Should().NotContain("boom"); // Must not leak exception details
    }
}
