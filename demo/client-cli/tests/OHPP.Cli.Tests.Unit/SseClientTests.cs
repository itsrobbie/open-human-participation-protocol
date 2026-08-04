using System.Net;
using System.Text;
using FluentAssertions;
using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure;
using Xunit;

namespace OHPP.Cli.Tests.Unit;

public sealed class SseClientTests
{
    [Fact]
    public async Task SseClient_RequestEvent_MapsIncomingRequest()
    {
        var requestId = Guid.NewGuid();
        var stream = $$"""
            event: new_request
            data: {"requestId":"{{requestId}}","appId":"bank.test","summary":"Approve transfer","type":"Select","options":[{"key":"approve","label":"Approve"}],"receivedAt":"2026-08-01T08:00:00Z"}


            """;
        var handler = new StubHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(stream, Encoding.UTF8, "text/event-stream")
        });
        var client = new SseClient(new HttpClient(handler), new CliConfig
        {
            DeviceToken = "ohpp_dev_test",
            ResolverUrl = "http://resolver.test"
        });

        var received = new List<IncomingRequest>();
        await foreach (var request in client.ConnectAsync())
            received.Add(request);

        received.Should().ContainSingle();
        received[0].RequestId.Should().Be(requestId);
        received[0].Options.Should().ContainSingle(option => option.Key == "approve");
    }

    private sealed class StubHttpMessageHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(response);
    }
}
