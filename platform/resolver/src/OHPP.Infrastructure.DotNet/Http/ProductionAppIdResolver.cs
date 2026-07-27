namespace OHPP.Infrastructure.DotNet.Http;

public sealed class ProductionAppIdResolver : IAppIdResolver
{
    public string ResolveBaseUrl(string appId)
    {
        return $"https://{appId}";
    }
}
