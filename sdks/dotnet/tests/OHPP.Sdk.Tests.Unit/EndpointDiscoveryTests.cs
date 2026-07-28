using System.Net;
using FluentAssertions;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class EndpointDiscoveryTests
{
    private static ServiceMetadata CreateTestMetadata() => new()
    {
        Name = "Test Resolver",
        ProtocolVersion = new ProtocolVersionRange { Min = "1.0", Max = "1.0" },
        Endpoints = new ServiceEndpoints
        {
            Participate = "https://resolver.test/api/participate",
            ParticipateStatus = "https://resolver.test/api/participate/{requestId}/status",
            Keys = "https://resolver.test/.well-known/ohpp/keys"
        }
    };

    [Fact]
    public async Task GetMetadata_ValidResponse_ReturnsMetadata()
    {
        var metadata = CreateTestMetadata();
        var json = OhppJsonSerialiser.Serialise(metadata);
        var handler = new FakeHttpHandler(json, HttpStatusCode.OK);
        var client = new HttpClient(handler);
        var discovery = new EndpointDiscovery(client, cacheDurationSeconds: 60);

        var result = await discovery.GetMetadataAsync("https://resolver.test");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Test Resolver");
        result.Endpoints.Participate.Should().Be("https://resolver.test/api/participate");
    }

    [Fact]
    public async Task GetMetadata_404Response_ReturnsNull()
    {
        var handler = new FakeHttpHandler("", HttpStatusCode.NotFound);
        var client = new HttpClient(handler);
        var discovery = new EndpointDiscovery(client);

        var result = await discovery.GetMetadataAsync("https://resolver.test");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetMetadata_CachesSubsequentCalls()
    {
        var metadata = CreateTestMetadata();
        var json = OhppJsonSerialiser.Serialise(metadata);
        var handler = new FakeHttpHandler(json, HttpStatusCode.OK);
        var client = new HttpClient(handler);
        var discovery = new EndpointDiscovery(client, cacheDurationSeconds: 60);

        await discovery.GetMetadataAsync("https://resolver.test");
        await discovery.GetMetadataAsync("https://resolver.test");

        handler.CallCount.Should().Be(1);
    }

    [Fact]
    public async Task InvalidateCache_ForcesRefetch()
    {
        var metadata = CreateTestMetadata();
        var json = OhppJsonSerialiser.Serialise(metadata);
        var handler = new FakeHttpHandler(json, HttpStatusCode.OK);
        var client = new HttpClient(handler);
        var discovery = new EndpointDiscovery(client, cacheDurationSeconds: 60);

        await discovery.GetMetadataAsync("https://resolver.test");
        discovery.InvalidateCache("https://resolver.test");
        await discovery.GetMetadataAsync("https://resolver.test");

        handler.CallCount.Should().Be(2);
    }

    private sealed class FakeHttpHandler : HttpMessageHandler
    {
        private readonly string _responseBody;
        private readonly HttpStatusCode _statusCode;
        public int CallCount { get; private set; }

        public FakeHttpHandler(string responseBody, HttpStatusCode statusCode)
        {
            _responseBody = responseBody;
            _statusCode = statusCode;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(new HttpResponseMessage(_statusCode)
            {
                Content = new StringContent(_responseBody, System.Text.Encoding.UTF8, "application/json")
            });
        }
    }
}
