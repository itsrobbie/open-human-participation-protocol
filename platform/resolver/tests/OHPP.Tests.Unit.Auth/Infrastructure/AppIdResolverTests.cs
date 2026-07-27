using FluentAssertions;
using OHPP.Infrastructure.DotNet.Http;
using Xunit;

namespace OHPP.Tests.Unit.Auth.Infrastructure;

public class AppIdResolverTests
{
    [Fact]
    public void ProductionResolver_ReturnsHttps()
    {
        var sut = new ProductionAppIdResolver();

        var result = sut.ResolveBaseUrl("bank.example.com");

        result.Should().Be("https://bank.example.com");
    }

    [Fact]
    public void DevModeResolver_OverrideExists_ReturnsOverride()
    {
        var overrides = new Dictionary<string, string>
        {
            { "bank.test", "http://bank:8080" }
        };
        var sut = new DevModeAppIdResolver(overrides);

        var result = sut.ResolveBaseUrl("bank.test");

        result.Should().Be("http://bank:8080");
    }

    [Fact]
    public void DevModeResolver_NoOverride_FallsBackToHttp()
    {
        var overrides = new Dictionary<string, string>();
        var sut = new DevModeAppIdResolver(overrides);

        var result = sut.ResolveBaseUrl("unknown.test");

        result.Should().Be("http://unknown.test");
    }
}
