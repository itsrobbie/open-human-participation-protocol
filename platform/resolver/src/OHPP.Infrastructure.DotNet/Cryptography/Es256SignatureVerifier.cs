using System.Security.Cryptography;
using System.Text;
using OHPP.Domain.Attestation;

namespace OHPP.Infrastructure.DotNet.Cryptography;

public sealed class Es256SignatureVerifier : ISignatureVerifier
{
    public bool Verify(string payload, string signature, string publicKeyPem)
    {
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportFromPem(publicKeyPem);

            var payloadBytes = Encoding.UTF8.GetBytes(payload);
            var signatureBytes = Base64UrlDecode(signature);

            return ecdsa.VerifyData(payloadBytes, signatureBytes, HashAlgorithmName.SHA256);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var base64 = input.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }
}
