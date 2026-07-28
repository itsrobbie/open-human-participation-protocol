using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OHPP.Cli.Domain;

namespace OHPP.Cli.Infrastructure;

/// <summary>
/// HTTP client for communicating with the Resolver's device endpoints.
/// </summary>
public sealed class HttpResolverClient : IResolverClient
{
    private readonly HttpClient _httpClient;
    private readonly CliConfig _config;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public HttpResolverClient(HttpClient httpClient, CliConfig config)
    {
        _httpClient = httpClient;
        _config = config;
        _httpClient.BaseAddress = new Uri(config.ResolverUrl!);
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.DeviceToken);
    }

    public async Task<bool> RegisterPublicKeyAsync(string publicKeyPem, string algorithm, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync("/api/devices/me/keys",
            new { publicKey = publicKeyPem, algorithm }, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<IncomingRequest>> GetPendingRequestsAsync(CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.GetAsync("/api/devices/me/pending", cancellationToken);
        if (!response.IsSuccessStatusCode)
            return Array.Empty<IncomingRequest>();

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var requests = JsonSerializer.Deserialize<List<IncomingRequest>>(json, JsonOptions);
        return requests ?? (IReadOnlyList<IncomingRequest>)Array.Empty<IncomingRequest>();
    }

    public async Task<bool> SubmitAttestationAsync(Guid requestId, string attestationPayload, string signature, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync("/api/devices/me/attestations",
            new { requestId, attestationPayload, deviceSignature = signature }, cancellationToken);
        return response.IsSuccessStatusCode;
    }
}
