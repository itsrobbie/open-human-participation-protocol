using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk;

/// <summary>
/// HTTP client implementation for communicating with an OHPP Resolver.
/// Handles request submission, status polling, cancellation, and attestation verification.
/// </summary>
public sealed class OhppRequesterClient : IOhppRequesterClient
{
    private readonly HttpClient _httpClient;
    private readonly EndpointDiscovery _discovery;

    public OhppRequesterClient(HttpClient httpClient, EndpointDiscovery discovery)
    {
        _httpClient = httpClient;
        _discovery = discovery;
    }

    public async Task<ParticipationResult> SendRequestAsync(
        ParticipationRequest request,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        var metadata = await _discovery.GetMetadataAsync(resolverBaseUrl, cancellationToken);
        if (metadata is null)
            return ParticipationResult.Fail("Could not discover Resolver metadata");

        var payload = OhppJsonSerialiser.Serialise(request);
        var body = new { payload };
        var json = OhppJsonSerialiser.Serialise(body);

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, metadata.Endpoints.Participate);
        httpRequest.Content = new StringContent(json, Encoding.UTF8, "application/json");
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = TryExtractError(responseBody) ?? $"HTTP {(int)response.StatusCode}";
            return ParticipationResult.Fail(error, (int)response.StatusCode);
        }

        ParticipateResponse? result;
        try
        {
            result = OhppJsonSerialiser.Deserialise<ParticipateResponse>(responseBody);
        }
        catch (JsonException)
        {
            return ParticipationResult.Fail("Could not parse participation response");
        }
        if (result?.RequestId is null)
            return ParticipationResult.Fail("Response missing requestId");

        return ParticipationResult.Ok(result.RequestId);
    }

    public async Task<RequestStatusResult> GetStatusAsync(
        string requestId,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        var metadata = await _discovery.GetMetadataAsync(resolverBaseUrl, cancellationToken);
        if (metadata is null)
            return RequestStatusResult.Fail("Could not discover Resolver metadata");

        var url = metadata.Endpoints.ParticipateStatus.Replace("{requestId}", requestId);

        using var httpRequest = new HttpRequestMessage(HttpMethod.Get, url);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = TryExtractError(responseBody) ?? $"HTTP {(int)response.StatusCode}";
            return RequestStatusResult.Fail(error, (int)response.StatusCode);
        }

        StatusResponse? statusResponse;
        try
        {
            statusResponse = OhppJsonSerialiser.Deserialise<StatusResponse>(responseBody);
        }
        catch (JsonException)
        {
            return RequestStatusResult.Fail("Could not parse status response");
        }
        if (statusResponse is null)
            return RequestStatusResult.Fail("Could not parse status response");

        return RequestStatusResult.Ok(
            statusResponse.Status,
            statusResponse.Attestation,
            statusResponse.SelectedOption,
            statusResponse.SelectedOptions,
            statusResponse.Value);
    }

    public async Task<CancelResult> CancelRequestAsync(
        string requestId,
        string resolverBaseUrl,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        var metadata = await _discovery.GetMetadataAsync(resolverBaseUrl, cancellationToken);
        if (metadata is null)
            return CancelResult.Fail("Could not discover Resolver metadata");

        // The cancel endpoint pattern uses the status URL base with /cancel
        var url = metadata.Endpoints.ParticipateStatus
            .Replace("{requestId}", requestId)
            .Replace("/status", "/cancel");

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(httpRequest, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var error = TryExtractError(responseBody) ?? $"HTTP {(int)response.StatusCode}";
            return CancelResult.Fail(error, (int)response.StatusCode);
        }

        return CancelResult.Ok();
    }

    public async Task<VerificationResult> VerifyAttestationAsync(
        AttestationEnvelope envelope,
        string resolverBaseUrl,
        CancellationToken cancellationToken = default)
    {
        var metadata = await _discovery.GetMetadataAsync(resolverBaseUrl, cancellationToken);
        if (metadata is null)
            return VerificationResult.Invalid("Could not discover Resolver metadata");

        // Fetch JWKS
        var jwksResponse = await _httpClient.GetAsync(metadata.Endpoints.Keys, cancellationToken);
        if (!jwksResponse.IsSuccessStatusCode)
            return VerificationResult.Invalid("Could not fetch Resolver JWKS");

        var jwksJson = await jwksResponse.Content.ReadAsStringAsync(cancellationToken);
        JwkSet? jwks;
        try
        {
            jwks = OhppJsonSerialiser.Deserialise<JwkSet>(jwksJson);
        }
        catch (JsonException)
        {
            return VerificationResult.Invalid("Could not parse JWKS response");
        }
        if (jwks is null)
            return VerificationResult.Invalid("Could not parse JWKS response");

        // Find the key matching the outer signature
        var keyId = envelope.OuterSignature.KeyId;
        var matchingKey = jwks.Keys.FirstOrDefault(k => k.Kid == keyId);
        if (matchingKey is null)
            return VerificationResult.Invalid($"Key '{keyId}' not found in Resolver JWKS");

        if (envelope.OuterSignature.Algorithm != SignatureAlgorithm.ES256)
            return VerificationResult.Invalid($"Unsupported signature algorithm '{envelope.OuterSignature.Algorithm}'");

        // Verify the outer signature using the public key
        var payload = OhppJsonSerialiser.SerialiseCanonical(envelope.InnerAttestation);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        byte[] signatureBytes;
        try
        {
            signatureBytes = Base64UrlDecode(envelope.OuterSignature.Value);
        }
        catch (FormatException)
        {
            return VerificationResult.Invalid("Outer signature is not valid base64url");
        }

        var isValid = VerifySignature(
            payloadBytes,
            signatureBytes,
            matchingKey,
            envelope.OuterSignature.Algorithm);

        return isValid
            ? VerificationResult.Verified()
            : VerificationResult.Invalid("Outer signature verification failed");
    }

    public async Task<ServiceMetadata?> DiscoverMetadataAsync(
        string resolverBaseUrl,
        CancellationToken cancellationToken = default)
    {
        return await _discovery.GetMetadataAsync(resolverBaseUrl, cancellationToken);
    }

    private static bool VerifySignature(byte[] payload, byte[] signature, Jwk key, SignatureAlgorithm algorithm)
    {
        try
        {
            if (algorithm != SignatureAlgorithm.ES256)
                return false; // Only ES256 supported in this implementation

            if (key.Crv != "P-256" || key.Kty != "EC")
                return false;

            var xBytes = Base64UrlDecode(key.X);
            var yBytes = key.Y is not null ? Base64UrlDecode(key.Y) : Array.Empty<byte>();

            using var ecdsa = System.Security.Cryptography.ECDsa.Create(new System.Security.Cryptography.ECParameters
            {
                Curve = System.Security.Cryptography.ECCurve.NamedCurves.nistP256,
                Q = new System.Security.Cryptography.ECPoint
                {
                    X = xBytes,
                    Y = yBytes
                }
            });

            return ecdsa.VerifyData(payload, signature, System.Security.Cryptography.HashAlgorithmName.SHA256);
        }
        catch
        {
            return false;
        }
    }

    private static string? TryExtractError(string responseBody)
    {
        try
        {
            var doc = System.Text.Json.JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("error", out var errorProp))
                return errorProp.GetString();
            if (doc.RootElement.TryGetProperty("detail", out var detailProp))
                return detailProp.GetString();
        }
        catch
        {
            // Not JSON or no error property
        }
        return null;
    }

    private static byte[] Base64UrlDecode(string encoded)
    {
        var base64 = encoded.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }

    private sealed class ParticipateResponse
    {
        public string? RequestId { get; init; }
    }

    private sealed class StatusResponse
    {
        public RequestStatus Status { get; init; }
        public AttestationEnvelope? Attestation { get; init; }
        public string? SelectedOption { get; init; }
        public IReadOnlyList<string>? SelectedOptions { get; init; }
        public string? Value { get; init; }
    }
}
