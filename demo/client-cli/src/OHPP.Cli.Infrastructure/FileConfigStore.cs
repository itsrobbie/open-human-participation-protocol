using System.Text.Json;
using OHPP.Cli.Domain;

namespace OHPP.Cli.Infrastructure;

/// <summary>
/// Persists CLI configuration to a JSON file on disk.
/// Default location: ~/.ohpp/cli-config.json
/// </summary>
public sealed class FileConfigStore : IConfigStore
{
    private readonly string _configPath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public FileConfigStore(string? configPath = null)
    {
        _configPath = configPath ?? GetDefaultPath();
    }

    public async Task<CliConfig> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(_configPath))
            return new CliConfig();

        var json = await File.ReadAllTextAsync(_configPath, cancellationToken);
        return JsonSerializer.Deserialize<CliConfig>(json, JsonOptions) ?? new CliConfig();
    }

    public async Task SaveAsync(CliConfig config, CancellationToken cancellationToken = default)
    {
        var directory = Path.GetDirectoryName(_configPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            Directory.CreateDirectory(directory);

        var json = JsonSerializer.Serialize(config, JsonOptions);
        await File.WriteAllTextAsync(_configPath, json, cancellationToken);
    }

    private static string GetDefaultPath()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Path.Combine(home, ".ohpp", "cli-config.json");
    }
}
