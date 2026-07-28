using OHPP.Cli.Domain;

namespace OHPP.Cli.Services;

/// <summary>
/// Manages CLI configuration: initial setup, key generation, and persistence.
/// </summary>
public sealed class ConfigurationService
{
    private readonly IConfigStore _configStore;
    private readonly IKeyPairGenerator _keyPairGenerator;

    public ConfigurationService(IConfigStore configStore, IKeyPairGenerator keyPairGenerator)
    {
        _configStore = configStore;
        _keyPairGenerator = keyPairGenerator;
    }

    /// <summary>
    /// Configures the CLI with a device token and resolver URL.
    /// Generates a key pair if one doesn't exist.
    /// </summary>
    public async Task<CliConfig> ConfigureAsync(string deviceToken, string resolverUrl, CancellationToken cancellationToken = default)
    {
        var config = await _configStore.LoadAsync(cancellationToken);

        config.DeviceToken = deviceToken;
        config.ResolverUrl = resolverUrl.TrimEnd('/');

        if (!config.HasKeyPair)
        {
            var (publicKey, privateKey) = _keyPairGenerator.Generate();
            config.PublicKeyPem = publicKey;
            config.PrivateKeyPem = privateKey;
        }

        await _configStore.SaveAsync(config, cancellationToken);
        return config;
    }

    /// <summary>
    /// Loads the current configuration. Returns null if not configured.
    /// </summary>
    public async Task<CliConfig?> GetConfigAsync(CancellationToken cancellationToken = default)
    {
        var config = await _configStore.LoadAsync(cancellationToken);
        return config.IsConfigured ? config : null;
    }

    /// <summary>
    /// Regenerates the key pair (e.g. if the old one was compromised).
    /// </summary>
    public async Task<CliConfig> RegenerateKeysAsync(CancellationToken cancellationToken = default)
    {
        var config = await _configStore.LoadAsync(cancellationToken);

        var (publicKey, privateKey) = _keyPairGenerator.Generate();
        config.PublicKeyPem = publicKey;
        config.PrivateKeyPem = privateKey;

        await _configStore.SaveAsync(config, cancellationToken);
        return config;
    }
}
