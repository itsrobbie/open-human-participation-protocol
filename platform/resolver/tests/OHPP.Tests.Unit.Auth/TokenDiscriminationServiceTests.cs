using FluentAssertions;
using OHPP.Domain.Auth;
using OHPP.Services.Auth;
using Xunit;

namespace OHPP.Tests.Unit.Auth;

public class TokenDiscriminationServiceTests
{
    private readonly TokenDiscriminationService _sut = new();

    [Fact]
    public void TokenDiscrimination_JwtFormat_ReturnsIdentityProviderType()
    {
        // A JWT has 3 base64url segments separated by dots, starting with eyJ
        var jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature";

        var result = _sut.DetermineTokenType(jwt);

        result.Should().Be(TokenType.IdentityProvider);
    }

    [Fact]
    public void TokenDiscrimination_DeviceTokenPrefix_ReturnsDeviceType()
    {
        var token = "ohpp_dev_abc123def456";

        var result = _sut.DetermineTokenType(token);

        result.Should().Be(TokenType.Device);
    }

    [Fact]
    public void TokenDiscrimination_AppTokenPrefix_ReturnsAppAccessType()
    {
        var token = "ohpp_app_xyz789ghi012";

        var result = _sut.DetermineTokenType(token);

        result.Should().Be(TokenType.AppAccess);
    }

    [Fact]
    public void TokenDiscrimination_EmptyString_ReturnsUnknown()
    {
        var result = _sut.DetermineTokenType("");

        result.Should().Be(TokenType.Unknown);
    }

    [Fact]
    public void TokenDiscrimination_NullToken_ReturnsUnknown()
    {
        var result = _sut.DetermineTokenType(null!);

        result.Should().Be(TokenType.Unknown);
    }

    [Fact]
    public void TokenDiscrimination_RandomString_ReturnsUnknown()
    {
        var result = _sut.DetermineTokenType("some_random_token_value");

        result.Should().Be(TokenType.Unknown);
    }
}
