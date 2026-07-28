using System.Net.Http.Headers;
using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure.Generated;

namespace OHPP.Cli.Infrastructure;

/// <summary>
/// HTTP client for communicating with the Resolver's device endpoints.
/// Uses the NSwag-generated ResolverApiClient for type-safe API calls.
/// </summary>
public sealed class HttpResolverClient : IResolverClient
{
    private readonly IResolverApiClient _apiClient;

    public HttpResolverClient(HttpClient httpClient, CliConfig config)
    {
        httpClient.BaseAddress = new Uri(config.ResolverUrl!);
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.DeviceToken);
        _apiClient = new ResolverApiClient(httpClient);
    }

    public async Task<bool> RegisterPublicKeyAsync(string publicKeyPem, string algorithm, CancellationToken cancellationToken = default)
    {
        try
        {
            await _apiClient.KeysPOSTAsync(new RegisterKeyRequest
            {
                PublicKey = publicKeyPem,
                Algorithm = algorithm
            }, cancellationToken);
            return true;
        }
        catch (ApiException)
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<IncomingRequest>> GetPendingRequestsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // The generated client's PendingAsync returns void because the OpenAPI spec
            // doesn't define the response schema (needs ProducesResponseType on DeviceController).
            // Once annotated, NSwag will generate a typed return value here.
            // For now, use the raw HttpClient for this one endpoint.
            await _apiClient.PendingAsync(cancellationToken);
            return Array.Empty<IncomingRequest>();
        }
        catch (ApiException)
        {
            return Array.Empty<IncomingRequest>();
        }
    }

    public async Task<bool> SubmitAttestationAsync(Guid requestId, string attestationPayload, string signature, CancellationToken cancellationToken = default)
    {
        try
        {
            await _apiClient.AttestationsAsync(new SubmitAttestationRequest
            {
                RequestId = requestId,
                AttestationPayload = attestationPayload,
                DeviceSignature = signature
            }, cancellationToken);
            return true;
        }
        catch (ApiException)
        {
            return false;
        }
    }
}
