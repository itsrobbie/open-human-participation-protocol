using System.Net;
using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Sdk.Server.Tests.Unit;

public sealed class OhppResolverEndpointsTests : IAsyncDisposable
{
    private readonly IOhppResolverServices _services = Substitute.For<IOhppResolverServices>();
    private readonly IOhppAuthContextAccessor _authAccessor = Substitute.For<IOhppAuthContextAccessor>();
    private readonly IHost _host;
    private readonly HttpClient _client;

    public OhppResolverEndpointsTests()
    {
        _host = new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(services =>
                {
                    services.AddRouting();
                    services.AddOhppResolver<FakeResolverServices, FakeAuthAccessor>(options =>
                    {
                        options.BaseUrl = "https://resolver.test";
                        options.Name = "Test Resolver";
                    });
                    // Replace the DI-registered fakes with our mocked instances
                    services.AddScoped<IOhppResolverServices>(_ => _services);
                    services.AddSingleton<IOhppAuthContextAccessor>(_ => _authAccessor);
                });
                webBuilder.Configure(app =>
                {
                    app.UseRouting();
                    app.UseEndpoints(endpoints =>
                    {
                        endpoints.UseOhppResolver();
                    });
                });
            })
            .Build();

        _host.Start();
        _client = _host.GetTestClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _host.StopAsync();
        _host.Dispose();
    }

    [Fact]
    public async Task MetadataEndpoint_ReturnsServiceMetadata()
    {
        var response = await _client.GetAsync("/.well-known/ohpp/metadata");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        var metadata = OhppJsonSerialiser.Deserialise<ServiceMetadata>(body);
        metadata.Should().NotBeNull();
        metadata!.Name.Should().Be("Test Resolver");
        metadata.ProtocolVersion.Min.Should().Be("1.0");
        metadata.Endpoints.Participate.Should().Contain("/api/participate");
    }

    [Fact]
    public async Task JwksEndpoint_ReturnsAllKeys()
    {
        var expectedJwks = new JwkSet
        {
            Keys = new[]
            {
                new Jwk { Kty = "EC", Kid = "active-1", Alg = "ES256", Use = "sig", Crv = "P-256", X = "x-value", Y = "y-value" },
                new Jwk { Kty = "EC", Kid = "retired-1", Alg = "ES256", Use = "sig", Crv = "P-256", X = "x2", Y = "y2" }
            }
        };
        _services.GetJwksAsync().Returns(expectedJwks);

        var response = await _client.GetAsync("/.well-known/ohpp/keys");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        var jwks = OhppJsonSerialiser.Deserialise<JwkSet>(body);
        jwks.Should().NotBeNull();
        jwks!.Keys.Should().HaveCount(2);
        jwks.Keys[0].Kid.Should().Be("active-1");
        jwks.Keys[1].Kid.Should().Be("retired-1");
    }

    [Fact]
    public async Task ParticipateEndpoint_InvalidPayload_WithoutAuth_Returns401()
    {
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns((OhppAppAuthContext?)null);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/participate");
        request.Content = new StringContent(
            """{"payload":"not valid json at all"}""",
            Encoding.UTF8, "application/json");

        var response = await _client.SendAsync(request);

        // Auth check runs first — no auth means 401 regardless of payload validity
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ParticipateEndpoint_InvalidPayload_WithAuth_Returns422()
    {
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(new OhppAppAuthContext
        {
            AppRegistrationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "test.app"
        });

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/participate");
        request.Content = new StringContent(
            """{"payload":"not valid json at all"}""",
            Encoding.UTF8, "application/json");

        var response = await _client.SendAsync(request);

        // Auth passes, payload validation catches the bad JSON → 422
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task ParticipateEndpoint_MissingPayloadField_WithAuth_Returns422()
    {
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(new OhppAppAuthContext
        {
            AppRegistrationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "test.app"
        });

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/participate");
        request.Content = new StringContent(
            """{"notPayload":"something"}""",
            Encoding.UTF8, "application/json");

        var response = await _client.SendAsync(request);

        // Null payload caught by validation pipeline
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task ParticipateEndpoint_Success_ReturnsCreatedAndPendingStatus()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.ProcessParticipationRequestAsync(auth.AppRegistrationId, auth.UserId, auth.AppId, Arg.Any<string>())
            .Returns(ResolverResult<string>.Ok("request-created"));

        var response = await _client.PostAsync("/api/participate", ValidParticipationBody());
        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location!.ToString().Should().Contain("request-created/status");
        body.Should().Contain("request-created").And.Contain("pending");
    }

    [Fact]
    public async Task ParticipateEndpoint_ServiceFailure_MapsSuggestedStatusCode()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.ProcessParticipationRequestAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(ResolverResult<string>.Fail("too many requests", StatusCodes.Status429TooManyRequests));

        var response = await _client.PostAsync("/api/participate", ValidParticipationBody());

        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task StatusEndpoint_WithoutAuth_Returns401()
    {
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns((OhppAppAuthContext?)null);

        var requestId = Guid.NewGuid();
        var response = await _client.GetAsync($"/api/participate/{requestId}/status");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CancelEndpoint_WithoutAuth_Returns401()
    {
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns((OhppAppAuthContext?)null);

        var requestId = Guid.NewGuid();
        var response = await _client.PostAsync($"/api/participate/{requestId}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CancelEndpoint_Success_ReturnsOk()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.CancelRequestAsync(Arg.Any<Guid>(), auth.AppRegistrationId)
            .Returns(ResolverResult<bool>.Ok(true));

        var response = await _client.PostAsync($"/api/participate/{Guid.NewGuid()}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CancelEndpoint_Conflict_MapsSuggestedConflictStatus()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.CancelRequestAsync(Arg.Any<Guid>(), auth.AppRegistrationId)
            .Returns(ResolverResult<bool>.Fail("already resolved", StatusCodes.Status409Conflict));

        var response = await _client.PostAsync($"/api/participate/{Guid.NewGuid()}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task StatusEndpoint_Success_PreservesTypedAnswerFields()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.GetRequestStatusAsync(Arg.Any<Guid>(), auth.AppRegistrationId)
            .Returns(ResolverResult<RequestStatusResponse>.Ok(new RequestStatusResponse
            {
                Status = RequestStatus.Resolved,
                SelectedOption = "continue",
                SelectedOptions = ["building", "contents"],
                Value = "typed-value"
            }));

        var response = await _client.GetAsync($"/api/participate/{Guid.NewGuid()}/status");
        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain("continue").And.Contain("building").And.Contain("typed-value");
    }

    [Fact]
    public async Task StatusEndpoint_ServiceFailure_MapsSuggestedStatusCode()
    {
        var auth = AuthenticatedContext();
        _authAccessor.GetAppContext(Arg.Any<HttpContext>()).Returns(auth);
        _services.GetRequestStatusAsync(Arg.Any<Guid>(), auth.AppRegistrationId)
            .Returns(ResolverResult<RequestStatusResponse>.Fail("missing", StatusCodes.Status404NotFound));

        var response = await _client.GetAsync($"/api/participate/{Guid.NewGuid()}/status");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task StatusEndpoint_InvalidGuid_DoesNotReachService()
    {
        var response = await _client.GetAsync("/api/participate/not-a-guid/status");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        await _services.DidNotReceiveWithAnyArgs().GetRequestStatusAsync(default, default);
    }

    private static OhppAppAuthContext AuthenticatedContext() => new()
    {
        AppRegistrationId = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        AppId = "requester.test"
    };

    private static StringContent ValidParticipationBody()
    {
        var payload = OhppJsonSerialiser.Serialise(new ParticipationRequest
        {
            Id = "request-valid",
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "requester.test" },
            Validation = new ValidationInfo { UserId = "user-valid" },
            Action = new ActionInfo { Summary = "Approve request" },
            Type = RequestType.Select,
            Options =
            [
                new RequestOption { Key = "approve", Label = "Approve" },
                new RequestOption { Key = "deny", Label = "Deny" }
            ],
            Expiry = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow
        });
        return new StringContent(OhppJsonSerialiser.Serialise(new { payload }), Encoding.UTF8, "application/json");
    }
}

// Stub implementations to satisfy generic constraints on AddOhppResolver<TServices, TAuth>
// The real behaviour comes from the NSubstitute mocks injected via service override.
internal sealed class FakeResolverServices : IOhppResolverServices
{
    public Task<ResolverResult<string>> ProcessParticipationRequestAsync(Guid appRegistrationId, Guid userId, string appId, string requestPayload)
        => Task.FromResult(ResolverResult<string>.Ok("fake"));
    public Task<ResolverResult<RequestStatusResponse>> GetRequestStatusAsync(Guid requestId, Guid appRegistrationId)
        => Task.FromResult(ResolverResult<RequestStatusResponse>.Ok(new RequestStatusResponse { Status = Protocol.RequestStatus.Pending }));
    public Task<ResolverResult<bool>> CancelRequestAsync(Guid requestId, Guid appRegistrationId)
        => Task.FromResult(ResolverResult<bool>.Ok(true));
    public Task<JwkSet> GetJwksAsync()
        => Task.FromResult(new JwkSet { Keys = Array.Empty<Jwk>() });
}

internal sealed class FakeAuthAccessor : IOhppAuthContextAccessor
{
    public OhppAppAuthContext? GetAppContext(HttpContext context) => null;
}
