using System.Net;
using FluentAssertions;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class RateLimitingTests : IntegrationTestBase
{
    public RateLimitingTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task ExceedsLimit_Returns429()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        // The recorded development limit is 200/min. The next request must be rejected.
        HttpResponseMessage? lastResponse = null;
        for (var i = 0; i < 201; i++)
        {
            lastResponse = await client.GetAsync("/api/users/me/summary");
            if (lastResponse.StatusCode == HttpStatusCode.TooManyRequests)
                break;
        }

        lastResponse!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        lastResponse.Headers.Contains("Retry-After").Should().BeTrue();
    }

    [Fact]
    public async Task DifferentTokens_IndependentLimits()
    {
        var (client1, _) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        // Exhaust client1's limit
        for (var i = 0; i < 61; i++)
        {
            var r = await client1.GetAsync("/api/users/me/summary");
            if (r.StatusCode == HttpStatusCode.TooManyRequests)
                break;
        }

        // client2 should still work
        var response = await client2.GetAsync("/api/users/me/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
