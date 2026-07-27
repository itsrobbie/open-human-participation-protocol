using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Attestation;
using OHPP.Services.Attestation;
using Xunit;

namespace OHPP.Tests.Unit.Attestation;

public class JwksServiceTests
{
    private readonly IKeyStore _keyStore = Substitute.For<IKeyStore>();
    private readonly JwksService _sut;

    public JwksServiceTests()
    {
        _sut = new JwksService(_keyStore);
    }

    [Fact]
    public async Task GetJwks_ReturnsAllKeysActiveAndRetired()
    {
        var activeKey = new SigningKey
        {
            KeyId = "active-key-1",
            Algorithm = "ES256",
            PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nActive...\n-----END PUBLIC KEY-----",
            PrivateKeyPem = "encrypted-active-pk",
            IsActive = true,
            CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
        };
        var retiredKey = new SigningKey
        {
            KeyId = "retired-key-1",
            Algorithm = "ES256",
            PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nRetired...\n-----END PUBLIC KEY-----",
            PrivateKeyPem = "encrypted-retired-pk",
            IsActive = false,
            CreatedAt = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
            RetiredAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
        };

        _keyStore.GetAllKeysAsync(Arg.Any<CancellationToken>())
            .Returns(new List<SigningKey> { activeKey, retiredKey });

        var result = await _sut.GetAllPublicKeysAsync();

        result.Should().HaveCount(2);

        var activeEntry = result.First(e => e.KeyId == "active-key-1");
        activeEntry.IsActive.Should().BeTrue();
        activeEntry.Algorithm.Should().Be("ES256");
        activeEntry.PublicKeyPem.Should().Be(activeKey.PublicKeyPem);

        var retiredEntry = result.First(e => e.KeyId == "retired-key-1");
        retiredEntry.IsActive.Should().BeFalse();
        retiredEntry.PublicKeyPem.Should().Be(retiredKey.PublicKeyPem);
    }

    [Fact]
    public async Task GetJwks_EmptyKeyStore_ReturnsEmptySet()
    {
        _keyStore.GetAllKeysAsync(Arg.Any<CancellationToken>())
            .Returns(new List<SigningKey>());

        var result = await _sut.GetAllPublicKeysAsync();

        result.Should().BeEmpty();
    }
}
