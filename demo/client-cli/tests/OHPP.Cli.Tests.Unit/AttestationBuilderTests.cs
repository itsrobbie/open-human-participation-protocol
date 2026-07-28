using System.Security.Cryptography;
using FluentAssertions;
using OHPP.Cli.Services;
using Xunit;

namespace OHPP.Cli.Tests.Unit;

public sealed class AttestationBuilderTests
{
    private readonly AttestationBuilder _builder = new();

    [Fact]
    public void AttestationBuilder_ValidInput_ProducesSignedPayload()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var privateKeyPem = ecdsa.ExportECPrivateKeyPem();

        var requestId = Guid.NewGuid();
        var payload = _builder.BuildPayload(requestId, "approve", "Select");

        var signature = _builder.Sign(payload, privateKeyPem);

        payload.Should().Contain(requestId.ToString());
        payload.Should().Contain("approve");
        payload.Should().Contain("Select");
        payload.Should().Contain("decisionTimestamp");
        signature.Should().NotBeNullOrWhiteSpace();
        signature.Should().NotContain("+");
        signature.Should().NotContain("/");
        signature.Should().NotContain("=");
    }

    [Fact]
    public void AttestationBuilder_SignatureVerifiable_WithPublicKey()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var privateKeyPem = ecdsa.ExportECPrivateKeyPem();
        var publicKeyPem = ecdsa.ExportSubjectPublicKeyInfoPem();

        var payload = _builder.BuildPayload(Guid.NewGuid(), "deny", "Select");
        var signature = _builder.Sign(payload, privateKeyPem);

        var isValid = _builder.Verify(payload, signature, publicKeyPem);

        isValid.Should().BeTrue();
    }

    [Fact]
    public void AttestationBuilder_TamperedPayload_VerificationFails()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var privateKeyPem = ecdsa.ExportECPrivateKeyPem();
        var publicKeyPem = ecdsa.ExportSubjectPublicKeyInfoPem();

        var payload = _builder.BuildPayload(Guid.NewGuid(), "approve", "Select");
        var signature = _builder.Sign(payload, privateKeyPem);

        var tampered = payload.Replace("approve", "deny");
        var isValid = _builder.Verify(tampered, signature, publicKeyPem);

        isValid.Should().BeFalse();
    }

    [Fact]
    public void AttestationBuilder_WrongKey_VerificationFails()
    {
        using var signingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var otherKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var privateKeyPem = signingKey.ExportECPrivateKeyPem();
        var wrongPublicKeyPem = otherKey.ExportSubjectPublicKeyInfoPem();

        var payload = _builder.BuildPayload(Guid.NewGuid(), "approve", "Text");
        var signature = _builder.Sign(payload, privateKeyPem);

        var isValid = _builder.Verify(payload, signature, wrongPublicKeyPem);

        isValid.Should().BeFalse();
    }

    [Fact]
    public void AttestationBuilder_BuildPayload_ContainsAllFields()
    {
        var requestId = Guid.NewGuid();
        var payload = _builder.BuildPayload(requestId, "confirmed", "Text", "Direct");

        payload.Should().Contain($"\"requestId\":\"{requestId}\"");
        payload.Should().Contain("\"decision\":\"confirmed\"");
        payload.Should().Contain("\"type\":\"Text\"");
        payload.Should().Contain("\"method\":\"Direct\"");
        payload.Should().Contain("\"decisionTimestamp\":");
    }
}
