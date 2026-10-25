using System.Net;
using System.Text;
using FluentAssertions;
using OHPP.Domain.Auth;
using OHPP.Infrastructure.Keycloak;
using Xunit;

namespace OHPP.Tests.Unit.Auth;

/// <summary>
/// Unit tests for the Keycloak identity broker. A stub HttpMessageHandler stands
/// in for Keycloak so we assert the broker's behaviour (which endpoints it calls,
/// how it maps provider responses to Results) without a live server.
/// </summary>
public sealed class KeycloakIdentityBrokerTests
{
    private static KeycloakOptions Options() => new()
    {
        Authority = "http://kc:8080/realms/ohpp",
        ServerBaseUrl = "http://kc:8080",
        Realm = "ohpp",
        TokenClientId = "ohpp-portal",
        AdminUsername = "admin",
        AdminPassword = "admin",
    };

    // A minimal unsigned JWT with the given sub, for the broker's sub extraction.
    private static string JwtWithSub(string sub)
    {
        static string B64Url(string s)
        {
            var b = Convert.ToBase64String(Encoding.UTF8.GetBytes(s));
            return b.TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
        return $"{B64Url("{\"alg\":\"none\"}")}.{B64Url($"{{\"sub\":\"{sub}\"}}")}.";
    }

    private static HttpClient Client(Func<HttpRequestMessage, HttpResponseMessage> handler)
        => new(new StubHandler(handler));

    [Fact]
    public async Task Register_creates_user_then_returns_tokens()
    {
        var opts = Options();
        var client = Client(req =>
        {
            var path = req.RequestUri!.AbsolutePath;
            if (path.EndsWith("/token") && req.RequestUri.AbsolutePath.Contains("/master/"))
                return Json(HttpStatusCode.OK, "{\"access_token\":\"admin-token\"}");
            // User create: the broker reads the new user's id from the Location
            // header (Keycloak returns it there), then sets the password.
            if (path.EndsWith("/users") && req.Method == HttpMethod.Post)
            {
                var resp = new HttpResponseMessage(HttpStatusCode.Created);
                resp.Headers.Location = new Uri(
                    "http://kc:8080/admin/realms/ohpp/users/user-123");
                return resp;
            }
            // Password set via the dedicated reset-password endpoint.
            if (path.EndsWith("/reset-password") && req.Method == HttpMethod.Put)
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            if (path.EndsWith("/token"))
                return Json(HttpStatusCode.OK,
                    $"{{\"access_token\":\"{JwtWithSub("user-123")}\",\"refresh_token\":\"r\",\"expires_in\":300}}");
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });
        var broker = new KeycloakIdentityBroker(opts, client);

        var result = await broker.RegisterAsync(
            new RegisterRequest("alice", "alice@example.com", "pw12345"));

        result.IsSuccess.Should().BeTrue(result.Error?.Message);
        result.Value!.UserId.Should().Be("user-123");
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Register_maps_keycloak_conflict_to_Conflict()
    {
        var opts = Options();
        var client = Client(req =>
        {
            var path = req.RequestUri!.AbsolutePath;
            if (path.Contains("/master/") && path.EndsWith("/token"))
                return Json(HttpStatusCode.OK, "{\"access_token\":\"admin-token\"}");
            if (path.EndsWith("/users"))
                return new HttpResponseMessage(HttpStatusCode.Conflict);
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });
        var broker = new KeycloakIdentityBroker(opts, client);

        var result = await broker.RegisterAsync(
            new RegisterRequest("bob", "bob@example.com", "pw12345"));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task Authenticate_maps_bad_credentials_to_Unauthorized()
    {
        var opts = Options();
        var client = Client(_ => Json(HttpStatusCode.Unauthorized, "{\"error\":\"invalid_grant\"}"));
        var broker = new KeycloakIdentityBroker(opts, client);

        var result = await broker.AuthenticateAsync(new AuthenticateRequest("x", "wrong"));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task Register_rejects_missing_fields_without_calling_the_provider()
    {
        var called = false;
        var client = Client(req => { called = true; return new HttpResponseMessage(HttpStatusCode.OK); });
        var broker = new KeycloakIdentityBroker(Options(), client);

        var result = await broker.RegisterAsync(new RegisterRequest("", "", ""));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
        called.Should().BeFalse("validation should short-circuit before any provider call");
    }

    private static HttpResponseMessage Json(HttpStatusCode code, string body)
        => new(code) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public StubHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }
}
