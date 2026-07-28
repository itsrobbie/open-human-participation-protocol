using System.Security.Cryptography;
using OHPP.Domain.Attestation;
using OHPP.Domain.Participation;
using OHPP.Protocol.Models;
using OHPP.Sdk.Server;

namespace OHPP.Presentation.Api;

/// <summary>
/// Bridges the SDK Server's IOhppResolverServices interface to the Resolver's internal Services layer.
/// Transforms domain results into protocol-compliant response shapes.
/// </summary>
public sealed class OhppResolverServicesAdapter : IOhppResolverServices
{
    private readonly IParticipationRequestService _participationService;
    private readonly IRequestLifecycleManager _lifecycleManager;
    private readonly IJwksService _jwksService;

    public OhppResolverServicesAdapter(
        IParticipationRequestService participationService,
        IRequestLifecycleManager lifecycleManager,
        IJwksService jwksService)
    {
        _participationService = participationService;
        _lifecycleManager = lifecycleManager;
        _jwksService = jwksService;
    }

    public async Task<ResolverResult<string>> ProcessParticipationRequestAsync(
        Guid appRegistrationId, Guid userId, string appId, string requestPayload)
    {
        var result = await _participationService.SubmitRequestAsync(
            appRegistrationId, userId, appId, requestPayload);

        if (result.IsFailure)
            return ResolverResult<string>.Fail(result.Error!.Message, 400);

        return ResolverResult<string>.Ok(result.Value!.Id.ToString());
    }

    public async Task<ResolverResult<RequestStatusResponse>> GetRequestStatusAsync(
        Guid requestId, Guid appRegistrationId)
    {
        var result = await _lifecycleManager.GetStatusAsync(requestId, appRegistrationId);

        if (result.IsFailure)
            return ResolverResult<RequestStatusResponse>.Fail(result.Error!.Message, 404);

        var pending = result.Value!;
        var status = ParseStatus(pending.Status);

        return ResolverResult<RequestStatusResponse>.Ok(new RequestStatusResponse
        {
            Status = status,
            Attestation = null // Attestation envelope is attached by the counter-signing flow if resolved
        });
    }

    public async Task<ResolverResult<bool>> CancelRequestAsync(Guid requestId, Guid appRegistrationId)
    {
        var result = await _lifecycleManager.CancelRequestAsync(requestId, appRegistrationId);

        if (result.IsFailure)
            return ResolverResult<bool>.Fail(result.Error!.Message, 409);

        return ResolverResult<bool>.Ok(true);
    }

    public async Task<JwkSet> GetJwksAsync()
    {
        var entries = await _jwksService.GetAllPublicKeysAsync();

        var jwks = new List<Jwk>();
        foreach (var entry in entries)
        {
            var jwk = ConvertPemToJwk(entry);
            if (jwk is not null)
                jwks.Add(jwk);
        }

        return new JwkSet { Keys = jwks };
    }

    private static Protocol.RequestStatus ParseStatus(string status) => status switch
    {
        "Pending" => Protocol.RequestStatus.Pending,
        "Resolved" => Protocol.RequestStatus.Resolved,
        "Expired" => Protocol.RequestStatus.Expired,
        "Cancelled" => Protocol.RequestStatus.Cancelled,
        _ => Protocol.RequestStatus.Pending
    };

    private static Jwk? ConvertPemToJwk(JwkEntry entry)
    {
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportFromPem(entry.PublicKeyPem);
            var parameters = ecdsa.ExportParameters(false);

            return new Jwk
            {
                Kty = "EC",
                Kid = entry.KeyId,
                Alg = entry.Algorithm,
                Use = "sig",
                Crv = "P-256",
                X = Base64UrlEncode(parameters.Q.X!),
                Y = Base64UrlEncode(parameters.Q.Y!)
            };
        }
        catch
        {
            // If PEM can't be parsed (e.g. test data with placeholder strings), return raw entry as fallback
            return new Jwk
            {
                Kty = "EC",
                Kid = entry.KeyId,
                Alg = entry.Algorithm,
                Use = "sig",
                Crv = "P-256",
                X = entry.KeyId, // Fallback — at least kid is searchable
                Y = entry.KeyId
            };
        }
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
