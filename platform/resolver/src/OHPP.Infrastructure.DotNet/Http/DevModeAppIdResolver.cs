namespace OHPP.Infrastructure.DotNet.Http;

public sealed class DevModeAppIdResolver : IAppIdResolver
{
    private readonly IReadOnlyDictionary<string, string> _overrides;

    public DevModeAppIdResolver(IReadOnlyDictionary<string, string> overrides)
    {
        _overrides = overrides;
    }

    public string ResolveBaseUrl(string appId)
    {
        return _overrides.TryGetValue(appId, out var baseUrl)
            ? baseUrl
            : $"http://{appId}";
    }
}
