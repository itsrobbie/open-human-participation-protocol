using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Presentation.Api.Auth;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class RateLimitingMiddlewareTests
{
    private readonly IRateLimitStore _rateLimitStore = Substitute.For<IRateLimitStore>();

    private HttpContext CreateContextWithPrincipal(AuthenticatedPrincipal? principal = null)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var services = new ServiceCollection();
        services.AddSingleton(_rateLimitStore);
        context.RequestServices = services.BuildServiceProvider();

        if (principal is not null)
            context.SetAuthenticatedPrincipal(principal);

        return context;
    }

    [Fact]
    public async Task NoPrincipal_SkipsRateLimiting_ProceedsToNext()
    {
        var context = CreateContextWithPrincipal(null);
        var nextCalled = false;

        var middleware = new RateLimitingMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        await _rateLimitStore.DidNotReceive().IsRateLimitedAsync(
            Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AuthenticatedUser_NotRateLimited_ProceedsAndIncrements()
    {
        var userId = Guid.NewGuid();
        var principal = new AuthenticatedPrincipal
        {
            UserId = userId,
            TokenType = TokenType.IdentityProvider
        };
        var context = CreateContextWithPrincipal(principal);

        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var nextCalled = false;
        var middleware = new RateLimitingMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        await _rateLimitStore.Received(1).IncrementAsync($"user:{userId}", Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AuthenticatedUser_RateLimited_Returns429()
    {
        var userId = Guid.NewGuid();
        var principal = new AuthenticatedPrincipal
        {
            UserId = userId,
            TokenType = TokenType.IdentityProvider
        };
        var context = CreateContextWithPrincipal(principal);

        _rateLimitStore.IsRateLimitedAsync($"user:{userId}", Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var nextCalled = false;
        var middleware = new RateLimitingMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(429);
        context.Response.Headers["Retry-After"].ToString().Should().Be("60");
    }

    [Fact]
    public async Task DeviceToken_UsesDeviceIdAsRateLimitKey()
    {
        var deviceId = Guid.NewGuid();
        var principal = new AuthenticatedPrincipal
        {
            UserId = Guid.NewGuid(),
            TokenType = TokenType.Device,
            DeviceId = deviceId
        };
        var context = CreateContextWithPrincipal(principal);

        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var middleware = new RateLimitingMiddleware(_ => Task.CompletedTask);
        await middleware.InvokeAsync(context);

        await _rateLimitStore.Received(1).IsRateLimitedAsync(
            $"device:{deviceId}", Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AppAccessToken_UsesAppRegistrationIdAsRateLimitKey()
    {
        var appRegId = Guid.NewGuid();
        var principal = new AuthenticatedPrincipal
        {
            UserId = Guid.NewGuid(),
            TokenType = TokenType.AppAccess,
            AppRegistrationId = appRegId,
            AppId = "bank.example.com"
        };
        var context = CreateContextWithPrincipal(principal);

        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var middleware = new RateLimitingMiddleware(_ => Task.CompletedTask);
        await middleware.InvokeAsync(context);

        await _rateLimitStore.Received(1).IsRateLimitedAsync(
            $"app:{appRegId}", Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }
}
