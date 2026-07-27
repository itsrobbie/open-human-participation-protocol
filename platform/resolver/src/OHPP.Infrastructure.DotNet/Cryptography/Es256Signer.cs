using System.Security.Cryptography;
using System.Text;
using OHPP.Domain.Attestation;

namespace OHPP.Infrastructure.DotNet.Cryptography;

public sealed class Es256Signer : ISigner
{
    public string Sign(string payload, string privateKeyPem)
    {
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportFromPem(privateKeyPem);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = ecdsa.SignData(payloadBytes, HashAlgorithmName.SHA256);

        return Base64UrlEncode(signatureBytes);
    }

    private static string Base64UrlEncode(byte[] data)
    {
        return Convert.ToBase64String(data)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
