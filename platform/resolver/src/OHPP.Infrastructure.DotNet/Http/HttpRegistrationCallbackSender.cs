using System.Net.Http.Json;
using OHPP.Domain.Registration;
using OHPP.Domain.Registration.Models;

namespace OHPP.Infrastructure.DotNet.Http;

public sealed class HttpRegistrationCallbackSender : IRegistrationCallbackSender
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAppIdResolver _appIdResolver;

    private const string HttpClientName = "RegistrationCallback";

    public HttpRegistrationCallbackSender(IHttpClientFactory httpClientFactory, IAppIdResolver appIdResolver)
    {
        _httpClientFactory = httpClientFactory;
        _appIdResolver = appIdResolver;
    }

    public async Task<bool> SendAsync(string appId, string callbackPath, RegistrationResponseData response, CancellationToken cancellationToken = default)
    {
        var baseUrl = _appIdResolver.ResolveBaseUrl(appId);
        var url = $"{baseUrl.TrimEnd('/')}{callbackPath}";

        var client = _httpClientFactory.CreateClient(HttpClientName);

        var httpResponse = await client.PostAsJsonAsync(url, new
        {
            challengeId = response.ChallengeId,
            resolverBaseUrl = response.ResolverBaseUrl,
            userId = response.UserId,
            accessToken = response.AccessToken,
            registrationId = response.RegistrationId,
            createdAt = response.CreatedAt.ToString("O")
        }, cancellationToken);

        return httpResponse.IsSuccessStatusCode;
    }
}
