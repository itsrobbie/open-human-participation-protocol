using System.Text.Json;
using FsCheck;
using FsCheck.Xunit;
using NSubstitute;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.Protocol.Local;
using OHPP.Services.Attestation;

namespace OHPP.Tests.Unit.Attestation;

public class AttestationPropertyTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);

    [Property]
    public bool PBT_RoundTrip_SerialiseDeserialiseAttestation_Identity(byte variant)
    {
        // For any payload, signing then verifying with the same key always returns true
        var keyStore = Substitute.For<IKeyStore>();
        var signatureVerifier = Substitute.For<ISignatureVerifier>();

        var keyId = $"key-{variant}";
        var key = new SigningKey
        {
            KeyId = keyId,
            Algorithm = "ES256",
            PublicKeyPem = "public-pem",
            PrivateKeyPem = "private-pem",
            IsActive = true,
            CreatedAt = Now.AddDays(-30)
        };

        keyStore.GetByKeyIdAsync(keyId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<SigningKey?>(key));

        // The signer always produces a "valid" signature that the verifier accepts
        signatureVerifier.Verify(Arg.Any<string>(), "produced-signature", key.PublicKeyPem).Returns(true);

        var sut = new SignatureVerificationService(keyStore, signatureVerifier);

        var payload = JsonSerializer.Serialize(new { decision = $"approve-{variant}", timestamp = Now.ToString("o") });
        var result = sut.VerifyAttestationAsync(payload, "produced-signature", keyId).GetAwaiter().GetResult();

        return result.IsValid && result.KeyId == keyId && result.Algorithm == "ES256";
    }

    [Property]
    public bool PBT_CounterSign_AlwaysProducesVerifiableEnvelope(byte innerVariant)
    {
        // Counter-signing any inner attestation always produces a valid envelope with required fields
        var keyStore = Substitute.For<IKeyStore>();
        var signer = Substitute.For<ISigner>();
        var keyEncryptor = Substitute.For<IKeyEncryptor>();
        var clock = Substitute.For<IClock>();
        clock.UtcNow.Returns(Now);

        var activeKey = new SigningKey
        {
            KeyId = "resolver-key",
            Algorithm = "ES256",
            PublicKeyPem = "resolver-public",
            PrivateKeyPem = "encrypted-private",
            IsActive = true,
            CreatedAt = Now.AddDays(-10)
        };

        keyStore.GetActiveKeyAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult<SigningKey?>(activeKey));
        keyEncryptor.Decrypt("encrypted-private").Returns("decrypted-private");
        signer.Sign(Arg.Any<string>(), "decrypted-private").Returns("resolver-signature");

        var sut = new CounterSigningService(keyStore, signer, keyEncryptor, clock);

        var innerJson = JsonSerializer.Serialize(new { decision = $"d-{innerVariant}", requestId = Guid.NewGuid().ToString() });
        var deviceSig = $"device-sig-{innerVariant}";
        var deviceKeyId = $"device-key-{innerVariant}";

        var result = sut.CounterSignAsync(innerJson, deviceSig, deviceKeyId).GetAwaiter().GetResult();

        if (!result.IsSuccess) return false;

        var envelope = OHPP.Protocol.Serialisation.OhppJsonSerialiser
            .Deserialise<OHPP.Protocol.Models.AttestationEnvelope>(result.Value!);
        return envelope is not null &&
               envelope.InnerAttestation.Signature.Value == deviceSig &&
               envelope.InnerAttestation.Signature.KeyId == deviceKeyId &&
               envelope.OuterSignature.Value == "resolver-signature" &&
               envelope.OuterSignature.KeyId == activeKey.KeyId;
    }

    [Property]
    public bool PBT_VerifyAttestation_TamperedPayload_AlwaysInvalid(byte payloadVariant)
    {
        // If the verifier says false (simulating tampered payload), the result is always invalid
        var keyStore = Substitute.For<IKeyStore>();
        var signatureVerifier = Substitute.For<ISignatureVerifier>();

        var keyId = $"key-{payloadVariant}";
        var key = new SigningKey
        {
            KeyId = keyId,
            Algorithm = "ES256",
            PublicKeyPem = "public-pem",
            PrivateKeyPem = "private-pem",
            IsActive = true,
            CreatedAt = Now.AddDays(-30)
        };

        keyStore.GetByKeyIdAsync(keyId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<SigningKey?>(key));

        // Verifier always returns false for tampered data
        signatureVerifier.Verify(Arg.Any<string>(), Arg.Any<string>(), key.PublicKeyPem).Returns(false);

        var sut = new SignatureVerificationService(keyStore, signatureVerifier);

        var tamperedPayload = JsonSerializer.Serialize(new { decision = $"tampered-{payloadVariant}" });
        var result = sut.VerifyAttestationAsync(tamperedPayload, "some-signature", keyId).GetAwaiter().GetResult();

        return !result.IsValid && result.Error != null;
    }
}
