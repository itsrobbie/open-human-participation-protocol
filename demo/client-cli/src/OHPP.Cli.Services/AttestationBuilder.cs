using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using OHPP.Cli.Domain;

namespace OHPP.Cli.Services;

/// <summary>
/// Builds and signs attestation payloads for submission to the Resolver.
/// The attestation is signed with the device's private key (ES256).
/// </summary>
public sealed class AttestationBuilder
{
    /// <summary>
    /// Builds an attestation payload JSON for the given decision.
    /// </summary>
    public string BuildPayload(Guid requestId, string decision, string type, string method = "Direct")
    {
        var payload = new
        {
            requestId = requestId.ToString(),
            decision,
            type,
            method,
            decisionTimestamp = DateTimeOffset.UtcNow.ToString("o")
        };

        return JsonSerializer.Serialize(payload);
    }

    /// <summary>
    /// Signs the attestation payload with the device's ES256 private key.
    /// Returns the base64url-encoded signature.
    /// </summary>
    public string Sign(string payload, string privateKeyPem)
    {
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(privateKeyPem);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = ecdsa.SignData(payloadBytes, HashAlgorithmName.SHA256);

        return Base64UrlEncode(signatureBytes);
    }

    /// <summary>
    /// Verifies a signature against a public key. Used for self-verification during testing.
    /// </summary>
    public bool Verify(string payload, string signature, string publicKeyPem)
    {
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(publicKeyPem);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = Base64UrlDecode(signature);

        return ecdsa.VerifyData(payloadBytes, signatureBytes, HashAlgorithmName.SHA256);
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

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
}
