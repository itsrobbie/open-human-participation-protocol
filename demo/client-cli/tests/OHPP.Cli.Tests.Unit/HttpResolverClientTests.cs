using System.Net;
using System.Text;
using FluentAssertions;
using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure;
using Xunit;

namespace OHPP.Cli.Tests.Unit;

public sealed class HttpResolverClientTests
{
    [Fact]
    public async Task HttpResolverClient_GetPendingRequests_MapsProtocolRequest()
    {
        var requestId = Guid.NewGuid();
        var handler = new StubHttpMessageHandler(request =>
        {
            request.RequestUri!.AbsolutePath.Should().Be("/api/devices/me/pending");
            return JsonResponse($$"""
                [{
                  "requestId":"{{requestId}}",
                  "appId":"bank.test",
                  "summary":"Approve transfer",
                  "description":"Review the transfer",
                  "rationale":"High value",
                  "category":"payments",
                  "type":"Select",
                  "options":[{"key":"approve","label":"Approve","freeText":false}],
                  "expiry":"2026-08-01T09:00:00Z",
                  "receivedAt":"2026-08-01T08:00:00Z"
                }]
                """);
        });
        var client = new HttpResolverClient(new HttpClient(handler), CreateConfig());

        var pending = await client.GetPendingRequestsAsync();

        pending.Should().NotBeNull();
        var results = pending!;
        results.Should().ContainSingle();
        results[0].RequestId.Should().Be(requestId);
        results[0].Summary.Should().Be("Approve transfer");
        results[0].Options.Should().ContainSingle(option => option.Key == "approve");
    }

    private static CliConfig CreateConfig() => new()
    {
        DeviceToken = "ohpp_dev_test",
        ResolverUrl = "http://resolver.test"
    };

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(responseFactory(request));
    }
}
