using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Attestation;
using OHPP.Services.Attestation;
using Xunit;

namespace OHPP.Tests.Unit.Attestation;

public class SignatureVerificationServiceTests
{
    private readonly IKeyStore _keyStore = Substitute.For<IKeyStore>();
    private readonly ISignatureVerifier _signatureVerifier = Substitute.For<ISignatureVerifier>();
    private readonly SignatureVerificationService _sut;

    public SignatureVerificationServiceTests()
    {
        _sut = new SignatureVerificationService(_keyStore, _signatureVerifier);
    }

    [Fact]
    public async Task VerifyAttestation_ValidSignature_ReturnsValid()
    {
        var key = CreateKey(isActive: true);
        var attestationJson = "{\"decision\":\"approve\"}";
        var signature = "valid-sig";

        _keyStore.GetByKeyIdAsync(key.KeyId, Arg.Any<CancellationToken>()).Returns(key);
        _signatureVerifier.Verify(attestationJson, signature, key.PublicKeyPem).Returns(true);

        var result = await _sut.VerifyAttestationAsync(attestationJson, signature, key.KeyId);

        result.IsValid.Should().BeTrue();
        result.KeyId.Should().Be(key.KeyId);
        result.Algorithm.Should().Be(key.Algorithm);
        result.Error.Should().BeNull();
    }

    [Fact]
    public async Task VerifyAttestation_TamperedPayload_ReturnsInvalid()
    {
        var key = CreateKey(isActive: true);
        var attestationJson = "{\"decision\":\"tampered\"}";
        var signature = "original-sig";

        _keyStore.GetByKeyIdAsync(key.KeyId, Arg.Any<CancellationToken>()).Returns(key);
        _signatureVerifier.Verify(attestationJson, signature, key.PublicKeyPem).Returns(false);

        var result = await _sut.VerifyAttestationAsync(attestationJson, signature, key.KeyId);

        result.IsValid.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task VerifyAttestation_UnknownKeyId_ReturnsInvalid()
    {
        _keyStore.GetByKeyIdAsync("unknown-key", Arg.Any<CancellationToken>()).Returns((SigningKey?)null);

        var result = await _sut.VerifyAttestationAsync("{}", "sig", "unknown-key");

        result.IsValid.Should().BeFalse();
        result.Error.Should().Contain("key");
    }

    [Fact]
    public async Task VerifyAttestation_WrongAlgorithm_ReturnsInvalid()
    {
        var key = CreateKey(isActive: true, algorithm: "RS256");
        var attestationJson = "{\"decision\":\"approve\"}";
        var signature = "sig-with-wrong-algo";

        _keyStore.GetByKeyIdAsync(key.KeyId, Arg.Any<CancellationToken>()).Returns(key);
        _signatureVerifier.Verify(attestationJson, signature, key.PublicKeyPem).Returns(false);

        var result = await _sut.VerifyAttestationAsync(attestationJson, signature, key.KeyId);

        result.IsValid.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task VerifyAttestation_ExpiredKey_StillVerifiesHistorical()
    {
        var key = CreateKey(isActive: false, retiredAt: new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero));
        var attestationJson = "{\"decision\":\"approve\"}";
        var signature = "historical-sig";

        _keyStore.GetByKeyIdAsync(key.KeyId, Arg.Any<CancellationToken>()).Returns(key);
        _signatureVerifier.Verify(attestationJson, signature, key.PublicKeyPem).Returns(true);

        var result = await _sut.VerifyAttestationAsync(attestationJson, signature, key.KeyId);

        result.IsValid.Should().BeTrue();
        result.KeyId.Should().Be(key.KeyId);
    }

    private static SigningKey CreateKey(bool isActive, string algorithm = "ES256", DateTimeOffset? retiredAt = null) => new()
    {
        KeyId = $"key-{Guid.NewGuid():N}",
        Algorithm = algorithm,
        PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----",
        PrivateKeyPem = "encrypted-private-key",
        IsActive = isActive,
        CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
        RetiredAt = retiredAt
    };
}
