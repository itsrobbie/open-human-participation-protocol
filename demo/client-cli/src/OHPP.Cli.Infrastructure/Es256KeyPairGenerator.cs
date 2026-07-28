using System.Security.Cryptography;
using OHPP.Cli.Domain;

namespace OHPP.Cli.Infrastructure;

/// <summary>
/// Generates ES256 (P-256) key pairs for attestation signing.
/// </summary>
public sealed class Es256KeyPairGenerator : IKeyPairGenerator
{
    public (string PublicKeyPem, string PrivateKeyPem) Generate()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);

        var publicKeyPem = ecdsa.ExportSubjectPublicKeyInfoPem();
        var privateKeyPem = ecdsa.ExportECPrivateKeyPem();

        return (publicKeyPem, privateKeyPem);
    }
}
