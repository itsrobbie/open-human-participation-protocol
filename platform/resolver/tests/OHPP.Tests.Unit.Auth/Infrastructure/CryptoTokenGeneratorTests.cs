using FluentAssertions;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.DotNet.Cryptography;
using Xunit;

namespace OHPP.Tests.Unit.Auth.Infrastructure;

public class CryptoTokenGeneratorTests
{
    private readonly CryptoTokenGenerator _sut = new();

    [Fact]
    public void GenerateDeviceToken_StartsWithCorrectPrefix()
    {
        var token = _sut.GenerateDeviceToken();
        token.Should().StartWith(TokenConstants.DeviceTokenPrefix);
    }

    [Fact]
    public void GenerateAppAccessToken_StartsWithCorrectPrefix()
    {
        var token = _sut.GenerateAppAccessToken();
        token.Should().StartWith(TokenConstants.AppTokenPrefix);
    }

    [Fact]
    public void GenerateDeviceToken_HasSufficientLength()
    {
        var token = _sut.GenerateDeviceToken();
        // Prefix (9 chars) + 32 bytes base64url (43 chars) = 52+
        token.Length.Should().BeGreaterThan(40);
    }

    [Fact]
    public void GenerateDeviceToken_IsUnique()
    {
        var tokens = Enumerable.Range(0, 100).Select(_ => _sut.GenerateDeviceToken()).ToHashSet();
        tokens.Should().HaveCount(100);
    }

    [Fact]
    public void GenerateAppAccessToken_IsUnique()
    {
        var tokens = Enumerable.Range(0, 100).Select(_ => _sut.GenerateAppAccessToken()).ToHashSet();
        tokens.Should().HaveCount(100);
    }
}
