using System.Net.Http.Json;
using OHPP.Domain.Registration;
using OHPP.Domain.Registration.Models;

namespace OHPP.Infrastructure.DotNet.Http;

public sealed class HttpAppMetadataFetcher : IAppMetadataFetcher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAppIdResolver _appIdResolver;

    private const string HttpClientName = "AppMetadata";
    private const string MetadataPath = "/.well-known/ohpp/app-metadata";

    public HttpAppMetadataFetcher(IHttpClientFactory httpClientFactory, IAppIdResolver appIdResolver)
    {
        _httpClientFactory = httpClientFactory;
        _appIdResolver = appIdResolver;
    }

    public async Task<AppMetadataData?> FetchAsync(string appId, CancellationToken cancellationToken = default)
    {
        var baseUrl = _appIdResolver.ResolveBaseUrl(appId);
        var url = $"{baseUrl.TrimEnd('/')}{MetadataPath}";

        var client = _httpClientFactory.CreateClient(HttpClientName);

        var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return null;

        var metadata = await response.Content.ReadFromJsonAsync<AppMetadataResponse>(cancellationToken: cancellationToken);
        if (metadata is null)
            return null;

        return new AppMetadataData
        {
            AppId = metadata.AppId ?? string.Empty,
            Name = metadata.Name ?? string.Empty,
            Icon = metadata.Icon,
            RegistrationCallbackPath = metadata.Endpoints?.RegistrationCallback ?? string.Empty,
            Version = metadata.Version ?? string.Empty
        };
    }

    private sealed class AppMetadataResponse
    {
        public string? AppId { get; set; }
        public string? Name { get; set; }
        public string? Icon { get; set; }
        public EndpointsResponse? Endpoints { get; set; }
        public string? Version { get; set; }
    }

    private sealed class EndpointsResponse
    {
        public string? RegistrationCallback { get; set; }
    }
}
