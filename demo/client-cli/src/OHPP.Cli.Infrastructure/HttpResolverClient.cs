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
            await _apiClient.RegisterDeviceKeyAsync(new RegisterKeyRequest
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

    public async Task<IReadOnlyList<IncomingRequest>?> GetPendingRequestsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var requests = await _apiClient.GetDevicePendingRequestsAsync(cancellationToken);
            return requests.Select(request => new IncomingRequest
            {
                RequestId = request.RequestId,
                AppId = request.AppId,
                Summary = request.Summary,
                Description = request.Description,
                Rationale = request.Rationale,
                Category = request.Category,
                Type = request.Type,
                Options = request.Options?.Select(option => new RequestOption
                {
                    Key = option.Key,
                    Label = option.Label,
                    FreeText = option.FreeText,
                    Placeholder = option.Placeholder
                }).ToList(),
                Expiry = request.Expiry,
                ReceivedAt = request.ReceivedAt
            }).ToList();
        }
        catch (ApiException ex) when (ex.StatusCode == 401 || ex.StatusCode == 403)
        {
            return null; // Token is invalid/revoked
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
            await _apiClient.SubmitDeviceAttestationAsync(new SubmitAttestationRequest
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
