using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Registration.Models;
using OHPP.Domain.Shared;
using OHPP.Services.Registration;
using Xunit;

namespace OHPP.Tests.Unit.Registration;

public class RegistrationCeremonyOrchestratorTests
{
    private readonly IChallengeValidator _challengeValidator = Substitute.For<IChallengeValidator>();
    private readonly IAppMetadataFetcher _metadataFetcher = Substitute.For<IAppMetadataFetcher>();
    private readonly IAppMetadataValidator _metadataValidator = Substitute.For<IAppMetadataValidator>();
    private readonly IRegistrationCallbackSender _callbackSender = Substitute.For<IRegistrationCallbackSender>();
    private readonly IAppRegistrationRepository _registrationRepo = Substitute.For<IAppRegistrationRepository>();
    private readonly IPendingRequestRepository _pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
    private readonly ITokenGenerator _tokenGenerator = Substitute.For<ITokenGenerator>();
    private readonly IRateLimitStore _rateLimitStore = Substitute.For<IRateLimitStore>();
    private readonly IResolverConfiguration _resolverConfig = Substitute.For<IResolverConfiguration>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly RegistrationCeremonyOrchestrator _sut;

    public RegistrationCeremonyOrchestratorTests()
    {
        _clock.UtcNow.Returns(new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero));
        _tokenGenerator.GenerateAppAccessToken().Returns("ohpp_app_generated123");
        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(false);
        _resolverConfig.BaseUrl.Returns("http://resolver:5000");

        _sut = new RegistrationCeremonyOrchestrator(
            _challengeValidator, _metadataFetcher, _metadataValidator,
            _callbackSender, _registrationRepo, _pendingRequestRepo,
            _tokenGenerator, _rateLimitStore, _resolverConfig, _clock);
    }

    [Fact]
    public async Task ProcessChallenge_ValidChallenge_FetchesMetadataAndCreatesRegistration()
    {
        var userId = Guid.NewGuid();
        var challenge = new ChallengeData { ChallengeId = Guid.NewGuid().ToString(), RequesterAppId = "bank.test", ExpiresAt = _clock.UtcNow.AddMinutes(5), CreatedAt = _clock.UtcNow };
        _challengeValidator.ValidateAndDecode(Arg.Any<string>()).Returns(Result<ChallengeData>.Success(challenge));
        var metadata = new AppMetadataData { AppId = "bank.test", Name = "Bank App", Icon = null, RegistrationCallbackPath = "/ohpp/callback", Version = "1.0" };
        _metadataFetcher.FetchAsync("bank.test", Arg.Any<CancellationToken>()).Returns(metadata);
        _metadataValidator.Validate(metadata, "bank.test").Returns(Result<bool>.Success(true));
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(true);
        _registrationRepo.CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<AppRegistration>());

        var result = await _sut.ProcessChallengeAsync(userId, "validBase64Payload");

        result.IsSuccess.Should().BeTrue();
        result.Value!.AppId.Should().Be("bank.test");
        result.Value.AccessToken.Should().Be("ohpp_app_generated123");
    }

    [Fact]
    public async Task ProcessChallenge_ExpiredChallenge_ReturnsError()
    {
        _challengeValidator.ValidateAndDecode(Arg.Any<string>())
            .Returns(Result<ChallengeData>.Failure(Error.Validation("Challenge expired", Array.Empty<ValidationFailure>())));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "expiredPayload");

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessChallenge_MetadataFetchFails_NetworkError_ReturnsError()
    {
        SetupValidChallenge();
        _metadataFetcher.FetchAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("metadata");
    }

    [Fact]
    public async Task ProcessChallenge_MetadataFetchFails_404_ReturnsError()
    {
        SetupValidChallenge();
        _metadataFetcher.FetchAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((AppMetadataData?)null);

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("metadata");
    }

    [Fact]
    public async Task ProcessChallenge_MetadataFetchFails_InvalidJson_ReturnsError()
    {
        SetupValidChallenge();
        _metadataFetcher.FetchAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new System.Text.Json.JsonException("Invalid JSON"));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("metadata");
    }

    [Fact]
    public async Task ProcessChallenge_MetadataFetchFails_MissingRequiredFields_ReturnsError()
    {
        SetupValidChallenge();
        var incompleteMetadata = new AppMetadataData { AppId = "bank.test", Name = "", RegistrationCallbackPath = "", Version = "1.0" };
        _metadataFetcher.FetchAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(incompleteMetadata);
        _metadataValidator.Validate(incompleteMetadata, "bank.test")
            .Returns(Result<bool>.Failure(Error.Validation("Missing required fields", Array.Empty<ValidationFailure>())));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessChallenge_MetadataAppIdMismatch_ReturnsError()
    {
        SetupValidChallenge();
        var metadata = new AppMetadataData { AppId = "other.test", Name = "Other", RegistrationCallbackPath = "/cb", Version = "1.0" };
        _metadataFetcher.FetchAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(metadata);
        _metadataValidator.Validate(metadata, "bank.test")
            .Returns(Result<bool>.Failure(Error.Validation("AppId mismatch", Array.Empty<ValidationFailure>())));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessChallenge_CallbackFails_NetworkError_AbortsRegistration()
    {
        SetupValidChallengeAndMetadata();
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("callback");
        await _registrationRepo.DidNotReceive().CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessChallenge_CallbackFails_Timeout_AbortsRegistration()
    {
        SetupValidChallengeAndMetadata();
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new TaskCanceledException("Request timed out"));

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Message.Should().Contain("callback");
    }

    [Fact]
    public async Task ProcessChallenge_CallbackFails_Non2xx_AbortsRegistration()
    {
        SetupValidChallengeAndMetadata();
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(false);

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        await _registrationRepo.DidNotReceive().CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessChallenge_ExistingRegistration_RevokesOldAndCreatesNew()
    {
        var userId = Guid.NewGuid();
        var existingReg = new AppRegistration { Id = Guid.NewGuid(), UserId = userId, AppId = "bank.test", AppName = "Old", AccessToken = "old_token", ResolverBaseUrl = "http://old", RegisteredAt = _clock.UtcNow.AddDays(-30) };
        _registrationRepo.GetActiveByUserAndAppIdAsync(userId, "bank.test", Arg.Any<CancellationToken>()).Returns(existingReg);
        SetupValidChallengeAndMetadata();
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(true);
        _registrationRepo.CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<AppRegistration>());

        var result = await _sut.ProcessChallengeAsync(userId, "validPayload");

        result.IsSuccess.Should().BeTrue();
        await _registrationRepo.Received(1).UpdateAsync(Arg.Is<AppRegistration>(r => r.RevokedAt != null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessChallenge_GeneratesUniqueAccessToken()
    {
        SetupValidChallengeAndMetadata();
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(true);
        _registrationRepo.CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<AppRegistration>());

        await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        _tokenGenerator.Received(1).GenerateAppAccessToken();
    }

    [Fact]
    public async Task ProcessChallenge_StoresAppNameAndIcon()
    {
        SetupValidChallengeAndMetadata(appName: "My Bank", appIcon: "https://bank.test/icon.png");
        _callbackSender.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<RegistrationResponseData>(), Arg.Any<CancellationToken>()).Returns(true);
        _registrationRepo.CreateAsync(Arg.Any<AppRegistration>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<AppRegistration>());

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.Value!.AppName.Should().Be("My Bank");
        result.Value.AppIcon.Should().Be("https://bank.test/icon.png");
    }

    [Fact]
    public async Task ProcessChallenge_RateLimitExceeded_ReturnsError()
    {
        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.ProcessChallengeAsync(Guid.NewGuid(), "validPayload");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("RATE_LIMITED");
    }

    [Fact]
    public async Task RevokeApp_ActiveApp_SetsRevokedAt()
    {
        var userId = Guid.NewGuid();
        var reg = new AppRegistration { Id = Guid.NewGuid(), UserId = userId, AppId = "bank.test", AppName = "Bank", AccessToken = "t", ResolverBaseUrl = "http://r", RegisteredAt = _clock.UtcNow.AddDays(-10) };
        _registrationRepo.GetByIdAsync(reg.Id, Arg.Any<CancellationToken>()).Returns(reg);

        var result = await _sut.RevokeAppAsync(userId, reg.Id);

        result.IsSuccess.Should().BeTrue();
        await _registrationRepo.Received(1).UpdateAsync(Arg.Is<AppRegistration>(r => r.RevokedAt != null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RevokeApp_AlreadyRevoked_ReturnsError()
    {
        var userId = Guid.NewGuid();
        var reg = new AppRegistration { Id = Guid.NewGuid(), UserId = userId, AppId = "bank.test", AppName = "Bank", AccessToken = "t", ResolverBaseUrl = "http://r", RegisteredAt = _clock.UtcNow.AddDays(-10), RevokedAt = _clock.UtcNow.AddDays(-1) };
        _registrationRepo.GetByIdAsync(reg.Id, Arg.Any<CancellationToken>()).Returns(reg);

        var result = await _sut.RevokeAppAsync(userId, reg.Id);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task RevokeApp_NotOwned_ReturnsError()
    {
        var otherUserId = Guid.NewGuid();
        var reg = new AppRegistration { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), AppId = "bank.test", AppName = "Bank", AccessToken = "t", ResolverBaseUrl = "http://r", RegisteredAt = _clock.UtcNow.AddDays(-10) };
        _registrationRepo.GetByIdAsync(reg.Id, Arg.Any<CancellationToken>()).Returns(reg);

        var result = await _sut.RevokeAppAsync(otherUserId, reg.Id);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RevokeApp_CancelsPendingRequests()
    {
        var userId = Guid.NewGuid();
        var reg = new AppRegistration { Id = Guid.NewGuid(), UserId = userId, AppId = "bank.test", AppName = "Bank", AccessToken = "t", ResolverBaseUrl = "http://r", RegisteredAt = _clock.UtcNow.AddDays(-10) };
        _registrationRepo.GetByIdAsync(reg.Id, Arg.Any<CancellationToken>()).Returns(reg);

        await _sut.RevokeAppAsync(userId, reg.Id);

        await _pendingRequestRepo.Received(1).CancelAllForAppRegistrationAsync(reg.Id, Arg.Any<CancellationToken>());
    }

    private void SetupValidChallenge()
    {
        var challenge = new ChallengeData { ChallengeId = Guid.NewGuid().ToString(), RequesterAppId = "bank.test", ExpiresAt = _clock.UtcNow.AddMinutes(5), CreatedAt = _clock.UtcNow };
        _challengeValidator.ValidateAndDecode(Arg.Any<string>()).Returns(Result<ChallengeData>.Success(challenge));
    }

    private void SetupValidChallengeAndMetadata(string appName = "Bank App", string? appIcon = null)
    {
        SetupValidChallenge();
        var metadata = new AppMetadataData { AppId = "bank.test", Name = appName, Icon = appIcon, RegistrationCallbackPath = "/ohpp/callback", Version = "1.0" };
        _metadataFetcher.FetchAsync("bank.test", Arg.Any<CancellationToken>()).Returns(metadata);
        _metadataValidator.Validate(metadata, "bank.test").Returns(Result<bool>.Success(true));
    }
}
