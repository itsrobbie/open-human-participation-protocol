using FluentAssertions;
using NSubstitute;
using OHPP.Cli.Domain;
using OHPP.Cli.Services;
using Xunit;

namespace OHPP.Cli.Tests.Unit;

public sealed class ConfigurationServiceTests
{
    private readonly IConfigStore _configStore = Substitute.For<IConfigStore>();
    private readonly IKeyPairGenerator _keyPairGenerator = Substitute.For<IKeyPairGenerator>();
    private readonly ConfigurationService _service;

    public ConfigurationServiceTests()
    {
        _configStore.LoadAsync(Arg.Any<CancellationToken>()).Returns(new CliConfig());
        _keyPairGenerator.Generate().Returns(("public-key-pem", "private-key-pem"));
        _service = new ConfigurationService(_configStore, _keyPairGenerator);
    }

    [Fact]
    public async Task Configure_SetsTokenAndUrl()
    {
        var config = await _service.ConfigureAsync("ohpp_dev_abc", "http://localhost:5000");

        config.DeviceToken.Should().Be("ohpp_dev_abc");
        config.ResolverUrl.Should().Be("http://localhost:5000");
    }

    [Fact]
    public async Task Configure_GeneratesKeyPair_WhenNoneExists()
    {
        var config = await _service.ConfigureAsync("token", "http://resolver.test");

        config.PublicKeyPem.Should().Be("public-key-pem");
        config.PrivateKeyPem.Should().Be("private-key-pem");
        _keyPairGenerator.Received(1).Generate();
    }

    [Fact]
    public async Task Configure_DoesNotRegenerateKeys_WhenAlreadyExists()
    {
        var existing = new CliConfig
        {
            PublicKeyPem = "existing-pub",
            PrivateKeyPem = "existing-priv"
        };
        _configStore.LoadAsync(Arg.Any<CancellationToken>()).Returns(existing);

        var config = await _service.ConfigureAsync("token", "http://resolver.test");

        config.PublicKeyPem.Should().Be("existing-pub");
        config.PrivateKeyPem.Should().Be("existing-priv");
        _keyPairGenerator.DidNotReceive().Generate();
    }

    [Fact]
    public async Task Configure_TrimsTrailingSlash()
    {
        var config = await _service.ConfigureAsync("token", "http://resolver.test/");

        config.ResolverUrl.Should().Be("http://resolver.test");
    }

    [Fact]
    public async Task Configure_PersistsConfig()
    {
        await _service.ConfigureAsync("token", "http://resolver.test");

        await _configStore.Received(1).SaveAsync(
            Arg.Is<CliConfig>(c => c.DeviceToken == "token"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetConfig_ReturnsNull_WhenNotConfigured()
    {
        var result = await _service.GetConfigAsync();

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetConfig_ReturnsConfig_WhenConfigured()
    {
        _configStore.LoadAsync(Arg.Any<CancellationToken>()).Returns(new CliConfig
        {
            DeviceToken = "token",
            ResolverUrl = "http://resolver.test"
        });

        var result = await _service.GetConfigAsync();

        result.Should().NotBeNull();
        result!.DeviceToken.Should().Be("token");
    }

    [Fact]
    public async Task RegenerateKeys_ReplacesExistingKeys()
    {
        _configStore.LoadAsync(Arg.Any<CancellationToken>()).Returns(new CliConfig
        {
            DeviceToken = "token",
            ResolverUrl = "http://resolver.test",
            PublicKeyPem = "old-pub",
            PrivateKeyPem = "old-priv"
        });

        var config = await _service.RegenerateKeysAsync();

        config.PublicKeyPem.Should().Be("public-key-pem");
        config.PrivateKeyPem.Should().Be("private-key-pem");
        _keyPairGenerator.Received(1).Generate();
    }
}
