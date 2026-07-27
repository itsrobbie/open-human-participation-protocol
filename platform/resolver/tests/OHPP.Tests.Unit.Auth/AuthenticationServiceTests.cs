using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OHPP.Domain.Auth;
using OHPP.Domain.Shared;
using OHPP.Services.Auth;
using Xunit;

namespace OHPP.Tests.Unit.Auth;

public class AuthenticationServiceTests
{
    private readonly IIdentityTokenValidator _identityValidator = Substitute.For<IIdentityTokenValidator>();
    private readonly IDeviceTokenRepository _deviceRepo = Substitute.For<IDeviceTokenRepository>();
    private readonly IAppAccessTokenRepository _appTokenRepo = Substitute.For<IAppAccessTokenRepository>();
    private readonly IUserProfileService _userProfileService = Substitute.For<IUserProfileService>();
    private readonly AuthenticationService _sut;

    public AuthenticationServiceTests()
    {
        _sut = new AuthenticationService(
            _identityValidator, _deviceRepo, _appTokenRepo, _userProfileService);
    }

    [Fact]
    public async Task ResolveIdentityToken_ValidToken_ReturnsUser()
    {
        var claims = new IdentityTokenClaims { ExternalId = "ext-123", Email = "test@test.com", DisplayName = "Test" };
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(claims);
        var user = new User { Id = Guid.NewGuid(), ExternalId = "ext-123", Email = "test@test.com", DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow, LastLoginAt = DateTimeOffset.UtcNow };
        _userProfileService.GetOrCreateFromClaimsAsync(claims, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.ResolveIdentityTokenAsync("valid.jwt.token");

        result.IsSuccess.Should().BeTrue();
        result.Value!.UserId.Should().Be(user.Id);
        result.Value.TokenType.Should().Be(TokenType.IdentityProvider);
    }

    [Fact]
    public async Task ResolveIdentityToken_ExpiredToken_ThrowsAuthException()
    {
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Token expired"));

        var result = await _sut.ResolveIdentityTokenAsync("expired.jwt.token");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveIdentityToken_InvalidSignature_ThrowsAuthException()
    {
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Invalid signature"));

        var result = await _sut.ResolveIdentityTokenAsync("invalid.sig.token");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveIdentityToken_WrongAudience_ThrowsAuthException()
    {
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Wrong audience"));

        var result = await _sut.ResolveIdentityTokenAsync("wrong.aud.token");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveIdentityToken_NewUser_CreatesUserRecord()
    {
        var claims = new IdentityTokenClaims { ExternalId = "new-ext-456", Email = "new@test.com", DisplayName = "New User" };
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(claims);
        var user = new User { Id = Guid.NewGuid(), ExternalId = "new-ext-456", Email = "new@test.com", DisplayName = "New User", CreatedAt = DateTimeOffset.UtcNow, LastLoginAt = DateTimeOffset.UtcNow };
        _userProfileService.GetOrCreateFromClaimsAsync(claims, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.ResolveIdentityTokenAsync("new.user.token");

        result.IsSuccess.Should().BeTrue();
        await _userProfileService.Received(1).GetOrCreateFromClaimsAsync(claims, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResolveIdentityToken_ExistingUser_DelegatesToUserProfileService()
    {
        var claims = new IdentityTokenClaims { ExternalId = "ext-789", Email = "existing@test.com", DisplayName = "Existing" };
        _identityValidator.ValidateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(claims);
        var user = new User { Id = Guid.NewGuid(), ExternalId = "ext-789", Email = "existing@test.com", DisplayName = "Existing", CreatedAt = DateTimeOffset.UtcNow.AddDays(-30), LastLoginAt = DateTimeOffset.UtcNow };
        _userProfileService.GetOrCreateFromClaimsAsync(claims, Arg.Any<CancellationToken>()).Returns(user);

        var result = await _sut.ResolveIdentityTokenAsync("existing.user.token");

        result.IsSuccess.Should().BeTrue();
        await _userProfileService.Received(1).GetOrCreateFromClaimsAsync(claims, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResolveDeviceToken_ValidToken_ReturnsDevice()
    {
        var device = new Device { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Name = "CLI", DeviceType = "cli", DeviceToken = "ohpp_dev_abc", IsActive = true, RegisteredAt = DateTimeOffset.UtcNow };
        _deviceRepo.GetByTokenAsync("ohpp_dev_abc", Arg.Any<CancellationToken>()).Returns(device);

        var result = await _sut.ResolveDeviceTokenAsync("ohpp_dev_abc");

        result.IsSuccess.Should().BeTrue();
        result.Value!.UserId.Should().Be(device.UserId);
        result.Value.DeviceId.Should().Be(device.Id);
        result.Value.TokenType.Should().Be(TokenType.Device);
    }

    [Fact]
    public async Task ResolveDeviceToken_RevokedDevice_ThrowsAuthException()
    {
        var device = new Device { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Name = "CLI", DeviceType = "cli", DeviceToken = "ohpp_dev_revoked", IsActive = false, RegisteredAt = DateTimeOffset.UtcNow };
        _deviceRepo.GetByTokenAsync("ohpp_dev_revoked", Arg.Any<CancellationToken>()).Returns(device);

        var result = await _sut.ResolveDeviceTokenAsync("ohpp_dev_revoked");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveDeviceToken_UnknownToken_ThrowsAuthException()
    {
        _deviceRepo.GetByTokenAsync("ohpp_dev_unknown", Arg.Any<CancellationToken>()).Returns((Device?)null);

        var result = await _sut.ResolveDeviceTokenAsync("ohpp_dev_unknown");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveDeviceToken_DeviceNoPublicKey_ReturnsDeviceWithKeylessFlag()
    {
        var device = new Device { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Name = "CLI", DeviceType = "cli", DeviceToken = "ohpp_dev_nokey", PublicKey = null, IsActive = true, RegisteredAt = DateTimeOffset.UtcNow };
        _deviceRepo.GetByTokenAsync("ohpp_dev_nokey", Arg.Any<CancellationToken>()).Returns(device);

        var result = await _sut.ResolveDeviceTokenAsync("ohpp_dev_nokey");

        result.IsSuccess.Should().BeTrue();
        result.Value!.DeviceId.Should().Be(device.Id);
    }

    [Fact]
    public async Task ResolveAppToken_ValidToken_ReturnsAppRegistration()
    {
        var reg = new AppRegistrationToken { AppRegistrationId = Guid.NewGuid(), UserId = Guid.NewGuid(), AppId = "bank.test", RevokedAt = null };
        _appTokenRepo.GetByTokenAsync("ohpp_app_valid", Arg.Any<CancellationToken>()).Returns(reg);

        var result = await _sut.ResolveAppTokenAsync("ohpp_app_valid");

        result.IsSuccess.Should().BeTrue();
        result.Value!.UserId.Should().Be(reg.UserId);
        result.Value.AppRegistrationId.Should().Be(reg.AppRegistrationId);
        result.Value.TokenType.Should().Be(TokenType.AppAccess);
    }

    [Fact]
    public async Task ResolveAppToken_RevokedApp_ThrowsAuthException()
    {
        var reg = new AppRegistrationToken { AppRegistrationId = Guid.NewGuid(), UserId = Guid.NewGuid(), AppId = "bank.test", RevokedAt = DateTimeOffset.UtcNow.AddDays(-1) };
        _appTokenRepo.GetByTokenAsync("ohpp_app_revoked", Arg.Any<CancellationToken>()).Returns(reg);

        var result = await _sut.ResolveAppTokenAsync("ohpp_app_revoked");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ResolveAppToken_UnknownToken_ThrowsAuthException()
    {
        _appTokenRepo.GetByTokenAsync("ohpp_app_unknown", Arg.Any<CancellationToken>()).Returns((AppRegistrationToken?)null);

        var result = await _sut.ResolveAppTokenAsync("ohpp_app_unknown");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }
}
