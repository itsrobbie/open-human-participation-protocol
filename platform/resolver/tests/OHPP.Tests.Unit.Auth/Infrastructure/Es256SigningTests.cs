using System.Security.Cryptography;
using FluentAssertions;
using OHPP.Infrastructure.DotNet.Cryptography;
using Xunit;

namespace OHPP.Tests.Unit.Auth.Infrastructure;

public class Es256SigningTests
{
    private readonly Es256Signer _signer = new();
    private readonly Es256SignatureVerifier _verifier = new();
    private readonly string _privateKeyPem;
    private readonly string _publicKeyPem;

    public Es256SigningTests()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        _privateKeyPem = ecdsa.ExportECPrivateKeyPem();
        _publicKeyPem = ecdsa.ExportSubjectPublicKeyInfoPem();
    }

    [Fact]
    public void Sign_ThenVerify_ReturnsTrue()
    {
        var payload = "{\"decision\":\"approve\",\"requestId\":\"abc-123\"}";

        var signature = _signer.Sign(payload, _privateKeyPem);
        var isValid = _verifier.Verify(payload, signature, _publicKeyPem);

        isValid.Should().BeTrue();
    }

    [Fact]
    public void Verify_TamperedPayload_ReturnsFalse()
    {
        var payload = "{\"decision\":\"approve\"}";
        var signature = _signer.Sign(payload, _privateKeyPem);

        var tampered = "{\"decision\":\"deny\"}";
        var isValid = _verifier.Verify(tampered, signature, _publicKeyPem);

        isValid.Should().BeFalse();
    }

    [Fact]
    public void Verify_WrongKey_ReturnsFalse()
    {
        var payload = "{\"test\":\"data\"}";
        var signature = _signer.Sign(payload, _privateKeyPem);

        using var otherKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var otherPublicPem = otherKey.ExportSubjectPublicKeyInfoPem();

        var isValid = _verifier.Verify(payload, signature, otherPublicPem);

        isValid.Should().BeFalse();
    }

    [Fact]
    public void Verify_InvalidSignatureFormat_ReturnsFalse()
    {
        var isValid = _verifier.Verify("payload", "not-a-valid-signature!!!", _publicKeyPem);

        isValid.Should().BeFalse();
    }

    [Fact]
    public void Sign_ProducesBase64UrlEncodedOutput()
    {
        var payload = "test payload";
        var signature = _signer.Sign(payload, _privateKeyPem);

        signature.Should().NotContain("+");
        signature.Should().NotContain("/");
        signature.Should().NotContain("=");
    }
}
