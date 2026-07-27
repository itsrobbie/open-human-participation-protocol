namespace OHPP.Infrastructure.DotNet.Http;

public interface IAppIdResolver
{
    string ResolveBaseUrl(string appId);
}
