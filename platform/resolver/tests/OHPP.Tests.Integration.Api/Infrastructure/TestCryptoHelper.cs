using System.Security.Cryptography;
using System.Text;

namespace OHPP.Tests.Integration.Api.Infrastructure;

/// <summary>
/// Generates EC key pairs and signs payloads for integration tests
/// that require real cryptographic operations (attestation flow).
/// </summary>
public static class TestCryptoHelper
{
    public static (string PublicKeyPem, string PrivateKeyPem) GenerateEcKeyPair()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var publicKeyPem = ecdsa.ExportSubjectPublicKeyInfoPem();
        var privateKeyPem = ecdsa.ExportECPrivateKeyPem();
        return (publicKeyPem, privateKeyPem);
    }

    public static string Sign(string payload, string privateKeyPem)
    {
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(privateKeyPem);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = ecdsa.SignData(payloadBytes, HashAlgorithmName.SHA256);

        return Convert.ToBase64String(signatureBytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
