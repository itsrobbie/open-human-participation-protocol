using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using OHPP.Domain.Auth;
using OHPP.Domain.Shared;
using OHPP.Presentation.Api.Auth;
using OHPP.Presentation.Api.Middleware;
using Xunit;

namespace OHPP.Tests.Integration.Api.Middleware;

public sealed class TokenDiscriminationMiddlewareTests
{
    private readonly ITokenDiscriminationService _discriminator = Substitute.For<ITokenDiscriminationService>();
    private readonly IAuthenticationService _authService = Substitute.For<IAuthenticationService>();

    private HttpContext CreateContext(string? authorizationHeader = null, string path = "/api/test")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        if (authorizationHeader is not null)
            context.Request.Headers.Authorization = authorizationHeader;

        var services = new ServiceCollection();
        services.AddSingleton(_discriminator);
        services.AddSingleton(_authService);
        context.RequestServices = services.BuildServiceProvider();

        return context;
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/health/ready")]
    [InlineData("/.well-known/ohpp/metadata")]
    [InlineData("/.well-known/ohpp/keys")]
    public async Task AnonymousPaths_SkipsAuthentication(string path)
    {
        var context = CreateContext("Bearer some-token", path);
        var nextCalled = false;

        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().BeNull();
        _discriminator.DidNotReceive().DetermineTokenType(Arg.Any<string?>());
    }

    [Fact]
    public async Task NoAuthorizationHeader_ProceedsWithoutPrincipal()
    {
        var context = CreateContext(authorizationHeader: null);
        var nextCalled = false;

        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("Basic abc123")]
    [InlineData("Bearer ")]
    [InlineData("Bearer")]
    public async Task InvalidAuthorizationHeader_ProceedsWithoutPrincipal(string header)
    {
        var context = CreateContext(header);
        var nextCalled = false;

        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().BeNull();
    }

    [Fact]
    public async Task ValidDeviceToken_ResolvesPrincipal()
    {
        var token = "ohpp_dev_abc123";
        var context = CreateContext($"Bearer {token}");

        _discriminator.DetermineTokenType(token).Returns(TokenType.Device);
        var principal = new AuthenticatedPrincipal
        {
            UserId = Guid.NewGuid(),
            TokenType = TokenType.Device,
            DeviceId = Guid.NewGuid()
        };
        _authService.ResolveDeviceTokenAsync(token, Arg.Any<CancellationToken>())
            .Returns(Result<AuthenticatedPrincipal>.Success(principal));

        var nextCalled = false;
        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().Be(principal);
    }

    [Fact]
    public async Task ValidAppToken_ResolvesPrincipal()
    {
        var token = "ohpp_app_xyz789";
        var context = CreateContext($"Bearer {token}");

        _discriminator.DetermineTokenType(token).Returns(TokenType.AppAccess);
        var principal = new AuthenticatedPrincipal
        {
            UserId = Guid.NewGuid(),
            TokenType = TokenType.AppAccess,
            AppRegistrationId = Guid.NewGuid(),
            AppId = "bank.example.com"
        };
        _authService.ResolveAppTokenAsync(token, Arg.Any<CancellationToken>())
            .Returns(Result<AuthenticatedPrincipal>.Success(principal));

        var nextCalled = false;
        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().Be(principal);
    }

    [Fact]
    public async Task ValidIdentityToken_ResolvesPrincipal()
    {
        var token = "eyJhbGciOiJSUzI1NiJ9.valid-jwt";
        var context = CreateContext($"Bearer {token}");

        _discriminator.DetermineTokenType(token).Returns(TokenType.IdentityProvider);
        var principal = new AuthenticatedPrincipal
        {
            UserId = Guid.NewGuid(),
            TokenType = TokenType.IdentityProvider
        };
        _authService.ResolveIdentityTokenAsync(token, Arg.Any<CancellationToken>())
            .Returns(Result<AuthenticatedPrincipal>.Success(principal));

        var nextCalled = false;
        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().Be(principal);
    }

    [Fact]
    public async Task TokenResolutionFails_ProceedsWithoutPrincipal()
    {
        var token = "ohpp_dev_invalid";
        var context = CreateContext($"Bearer {token}");

        _discriminator.DetermineTokenType(token).Returns(TokenType.Device);
        _authService.ResolveDeviceTokenAsync(token, Arg.Any<CancellationToken>())
            .Returns(Result<AuthenticatedPrincipal>.Failure(Error.Unauthorized("Token revoked")));

        var nextCalled = false;
        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().BeNull();
    }

    [Fact]
    public async Task UnknownTokenType_ProceedsWithoutPrincipal()
    {
        var token = "random_garbage";
        var context = CreateContext($"Bearer {token}");

        _discriminator.DetermineTokenType(token).Returns(TokenType.Unknown);

        var nextCalled = false;
        var middleware = new TokenDiscriminationMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.GetAuthenticatedPrincipal().Should().BeNull();
    }
}
