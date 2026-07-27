using FluentAssertions;
using NSubstitute;
using OHPP.Infrastructure.DotNet.Cryptography;
using Xunit;

namespace OHPP.Tests.Unit.Auth.Infrastructure;

public class AesKeyEncryptorTests
{
    private readonly AesKeyEncryptor _sut;

    public AesKeyEncryptorTests()
    {
        var config = Substitute.For<IKeyEncryptionConfiguration>();
        config.EncryptionKey.Returns("test-encryption-passphrase-for-unit-tests");
        _sut = new AesKeyEncryptor(config);
    }

    [Fact]
    public void Encrypt_ThenDecrypt_ReturnsOriginal()
    {
        var original = "-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...\n-----END EC PRIVATE KEY-----";

        var encrypted = _sut.Encrypt(original);
        var decrypted = _sut.Decrypt(encrypted);

        decrypted.Should().Be(original);
    }

    [Fact]
    public void Encrypt_ProducesDifferentOutputFromInput()
    {
        var original = "some secret key material";

        var encrypted = _sut.Encrypt(original);

        encrypted.Should().NotBe(original);
    }

    [Fact]
    public void Encrypt_SameInput_ProducesDifferentCiphertext_DueToRandomIV()
    {
        var original = "same input each time";

        var encrypted1 = _sut.Encrypt(original);
        var encrypted2 = _sut.Encrypt(original);

        encrypted1.Should().NotBe(encrypted2);
    }

    [Fact]
    public void Decrypt_WithDifferentKey_Fails()
    {
        var config1 = Substitute.For<IKeyEncryptionConfiguration>();
        config1.EncryptionKey.Returns("key-one");
        var encryptor1 = new AesKeyEncryptor(config1);

        var config2 = Substitute.For<IKeyEncryptionConfiguration>();
        config2.EncryptionKey.Returns("key-two");
        var encryptor2 = new AesKeyEncryptor(config2);

        var encrypted = encryptor1.Encrypt("secret data");

        var act = () => encryptor2.Decrypt(encrypted);
        act.Should().Throw<Exception>();
    }
}
