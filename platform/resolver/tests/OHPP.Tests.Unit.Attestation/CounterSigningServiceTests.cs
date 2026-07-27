using System.Text.Json;
using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;
using OHPP.Services.Attestation;
using Xunit;

namespace OHPP.Tests.Unit.Attestation;

public class CounterSigningServiceTests
{
    private readonly IKeyStore _keyStore = Substitute.For<IKeyStore>();
    private readonly ISigner _signer = Substitute.For<ISigner>();
    private readonly IKeyEncryptor _keyEncryptor = Substitute.For<IKeyEncryptor>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly CounterSigningService _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);

    public CounterSigningServiceTests()
    {
        _clock.UtcNow.Returns(Now);
        _sut = new CounterSigningService(_keyStore, _signer, _keyEncryptor, _clock);
    }

    [Fact]
    public async Task CounterSign_ProducesValidEnvelope_WithInnerAndOuterSignature()
    {
        var activeKey = CreateActiveKey();
        var innerJson = "{\"requestId\":\"abc\",\"decision\":\"approve\"}";
        var deviceSignature = "device-sig-123";
        var deviceKeyId = "device-key-1";
        var resolverSignature = "resolver-sig-456";
        var decryptedPrivateKey = "decrypted-private-key-pem";

        _keyStore.GetActiveKeyAsync(Arg.Any<CancellationToken>()).Returns(activeKey);
        _keyEncryptor.Decrypt(activeKey.PrivateKeyPem).Returns(decryptedPrivateKey);
        _signer.Sign(Arg.Any<string>(), decryptedPrivateKey).Returns(resolverSignature);

        var result = await _sut.CounterSignAsync(innerJson, deviceSignature, deviceKeyId);

        result.IsSuccess.Should().BeTrue();

        var envelope = JsonSerializer.Deserialize<JsonElement>(result.Value!);
        envelope.GetProperty("innerAttestation").GetString().Should().Be(innerJson);
        envelope.GetProperty("deviceSignature").GetString().Should().Be(deviceSignature);
        envelope.GetProperty("deviceKeyId").GetString().Should().Be(deviceKeyId);
        envelope.GetProperty("resolverSignature").GetString().Should().Be(resolverSignature);
        envelope.GetProperty("resolverKeyId").GetString().Should().Be(activeKey.KeyId);
        envelope.GetProperty("resolverAlgorithm").GetString().Should().Be(activeKey.Algorithm);
    }

    [Fact]
    public async Task CounterSign_UsesActiveResolverKey()
    {
        var activeKey = CreateActiveKey();
        var innerJson = "{\"decision\":\"approve\"}";
        var decryptedPrivateKey = "decrypted-key";

        _keyStore.GetActiveKeyAsync(Arg.Any<CancellationToken>()).Returns(activeKey);
        _keyEncryptor.Decrypt(activeKey.PrivateKeyPem).Returns(decryptedPrivateKey);
        _signer.Sign(Arg.Any<string>(), decryptedPrivateKey).Returns("sig");

        await _sut.CounterSignAsync(innerJson, "dev-sig", "dev-key");

        await _keyStore.Received(1).GetActiveKeyAsync(Arg.Any<CancellationToken>());
        _keyEncryptor.Received(1).Decrypt(activeKey.PrivateKeyPem);
    }

    [Fact]
    public async Task CounterSign_NoActiveKey_ReturnsError()
    {
        _keyStore.GetActiveKeyAsync(Arg.Any<CancellationToken>()).Returns((SigningKey?)null);

        var result = await _sut.CounterSignAsync("{}", "dev-sig", "dev-key");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("SERVICE_UNAVAILABLE");
    }

    [Fact]
    public async Task CounterSign_InnerSignaturePreservedInEnvelope()
    {
        var activeKey = CreateActiveKey();
        var innerJson = "{\"requestId\":\"r1\",\"decision\":\"deny\"}";
        var deviceSignature = "original-device-signature";
        var deviceKeyId = "device-key-abc";

        _keyStore.GetActiveKeyAsync(Arg.Any<CancellationToken>()).Returns(activeKey);
        _keyEncryptor.Decrypt(activeKey.PrivateKeyPem).Returns("pk");
        _signer.Sign(Arg.Any<string>(), "pk").Returns("resolver-sig");

        var result = await _sut.CounterSignAsync(innerJson, deviceSignature, deviceKeyId);

        result.IsSuccess.Should().BeTrue();

        var envelope = JsonSerializer.Deserialize<JsonElement>(result.Value!);
        envelope.GetProperty("innerAttestation").GetString().Should().Be(innerJson);
        envelope.GetProperty("deviceSignature").GetString().Should().Be(deviceSignature);
        envelope.GetProperty("deviceKeyId").GetString().Should().Be(deviceKeyId);
    }

    private static SigningKey CreateActiveKey() => new()
    {
        KeyId = "resolver-key-1",
        Algorithm = "ES256",
        PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----",
        PrivateKeyPem = "encrypted-private-key-data",
        IsActive = true,
        CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
    };
}
