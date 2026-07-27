using System.Text.Json;
using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Services.Participation;
using Xunit;

namespace OHPP.Tests.Unit.Participation;

public class ParticipationRequestServiceTests
{
    private readonly IPendingRequestRepository _pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
    private readonly IDeviceTokenRepository _deviceTokenRepo = Substitute.For<IDeviceTokenRepository>();
    private readonly IAppRegistrationRepository _appRegistrationRepo = Substitute.For<IAppRegistrationRepository>();
    private readonly IRateLimitStore _rateLimitStore = Substitute.For<IRateLimitStore>();
    private readonly INotificationService _notificationService = Substitute.For<INotificationService>();
    private readonly INotificationChannel _notificationChannel = Substitute.For<INotificationChannel>();
    private readonly IRequestValidator _requestValidator = Substitute.For<IRequestValidator>();
    private readonly IRequestDeserialiser _requestDeserialiser = Substitute.For<IRequestDeserialiser>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly ParticipationRequestService _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _appRegistrationId = Guid.NewGuid();
    private const string AppId = "bank.test";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ParticipationRequestServiceTests()
    {
        _clock.UtcNow.Returns(Now);
        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(false);
        _deviceTokenRepo.GetActiveByUserIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice() });
        _pendingRequestRepo.CreateAsync(Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<PendingRequest>());
        _notificationService.NotifyNewRequestAsync(Arg.Any<Guid>(), Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>())
            .Returns(true);
        _appRegistrationRepo.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => new AppRegistration
            {
                Id = callInfo.Arg<Guid>(),
                UserId = _userId,
                AppId = AppId,
                AppName = "Bank App",
                AccessToken = "ohpp_app_test",
                ResolverBaseUrl = "http://resolver:5000",
                RegisteredAt = Now.AddDays(-10)
            });

        // Default: validator returns no errors
        _requestValidator.Validate(Arg.Any<string>(), Arg.Any<DateTimeOffset>()).Returns(Array.Empty<string>());

        _sut = new ParticipationRequestService(
            _pendingRequestRepo, _deviceTokenRepo, _appRegistrationRepo,
            _rateLimitStore, _notificationService, _notificationChannel,
            _requestValidator, _requestDeserialiser, _clock);
    }

    [Fact]
    public async Task SubmitRequest_ValidRequest_StoresAndNotifies()
    {
        var json = SerialiseValidRequest();
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = _userId.ToString(), Summary = "Approve payment", Type = "Select", Expiry = Now.AddMinutes(30)
        });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Pending");
        result.Value.AppId.Should().Be(AppId);
        result.Value.ActionSummary.Should().Be("Approve payment");
        await _pendingRequestRepo.Received(1).CreateAsync(Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>());
        await _notificationService.Received(1).NotifyNewRequestAsync(_userId, Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitRequest_UserIdMismatch_ReturnsError()
    {
        var json = SerialiseValidRequest(userId: Guid.NewGuid().ToString());
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = Guid.NewGuid().ToString(), Summary = "Approve payment", Type = "Select", Expiry = Now.AddMinutes(30)
        });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
        result.Error.Message.Should().Contain("User ID mismatch");
    }

    [Fact]
    public async Task SubmitRequest_NoActiveDevices_ReturnsError()
    {
        _deviceTokenRepo.GetActiveByUserIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new List<Device>());
        var json = SerialiseValidRequest();
        SetupDefaultDeserialiser(json);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
        result.Error.Message.Should().Contain("No active devices");
    }

    [Fact]
    public async Task SubmitRequest_ExpiredExpiry_ReturnsError()
    {
        var json = SerialiseValidRequest(expiry: Now.AddMinutes(-5));
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = _userId.ToString(), Summary = "Approve payment", Type = "Select", Expiry = Now.AddMinutes(-5)
        });
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "expiry must be in the future" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_NullExpiry_StoresPendingIndefinitely()
    {
        var json = SerialiseValidRequest(expiry: null, useDefaultExpiry: false);
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = _userId.ToString(), Summary = "Approve payment", Type = "Select", Expiry = null
        });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ExpiresAt.Should().BeNull();
        result.Value.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task SubmitRequest_SelectTypeNoOptions_ReturnsValidationError()
    {
        var json = SerialiseValidRequest(type: RequestType.Select, options: Array.Empty<RequestOption>(), overrideDefaultOptions: true);
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "options must contain at least 2 entries for Select type" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_SelectTypeSingleOption_ReturnsValidationError()
    {
        var json = SerialiseValidRequest(type: RequestType.Select, options: new[]
        {
            new RequestOption { Key = "a", Label = "Option A" }
        });
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "options must contain at least 2 entries for Select type" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_TextTypeWithOptions_ReturnsValidationError()
    {
        var json = SerialiseValidRequest(type: RequestType.Text, options: new[]
        {
            new RequestOption { Key = "a", Label = "Option A" },
            new RequestOption { Key = "b", Label = "Option B" }
        });
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "options must be null or empty for Text type" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_SummaryTooLong_ReturnsValidationError()
    {
        var longSummary = new string('x', ProtocolConstants.MaxLengths.Summary + 1);
        var json = SerialiseValidRequest(summary: longSummary);
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = _userId.ToString(), Summary = longSummary, Type = "Select", Expiry = Now.AddMinutes(30)
        });
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { $"action.summary must not exceed {ProtocolConstants.MaxLengths.Summary} characters" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_DescriptionTooLong_ReturnsValidationError()
    {
        var longDescription = new string('x', ProtocolConstants.MaxLengths.Description + 1);
        var json = SerialiseValidRequest(description: longDescription);
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { $"action.description must not exceed {ProtocolConstants.MaxLengths.Description} characters" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_DuplicateOptionKeys_ReturnsValidationError()
    {
        var json = SerialiseValidRequest(type: RequestType.Select, options: new[]
        {
            new RequestOption { Key = "dup", Label = "First" },
            new RequestOption { Key = "dup", Label = "Second" }
        });
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "options[].key must be unique within a request (duplicate: 'dup')" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_MultiselectMinMaxViolation_ReturnsValidationError()
    {
        var json = SerialiseValidRequest(type: RequestType.Multiselect, options: new[]
        {
            new RequestOption { Key = "only", Label = "Only One" }
        });
        SetupDefaultDeserialiser(json);
        _requestValidator.Validate(json, Arg.Any<DateTimeOffset>()).Returns(new[] { "options must contain at least 2 entries for Multiselect type" });

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitRequest_RateLimitExceeded_Returns429()
    {
        _rateLimitStore.IsRateLimitedAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(true);
        var json = SerialiseValidRequest();
        SetupDefaultDeserialiser(json);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("RATE_LIMITED");
    }

    [Fact]
    public async Task SubmitRequest_RevokedApp_ReturnsAuthError()
    {
        _appRegistrationRepo.GetByIdAsync(_appRegistrationId, Arg.Any<CancellationToken>())
            .Returns(new AppRegistration
            {
                Id = _appRegistrationId,
                UserId = _userId,
                AppId = AppId,
                AppName = "Bank App",
                AccessToken = "ohpp_app_test",
                ResolverBaseUrl = "http://resolver:5000",
                RegisteredAt = Now.AddDays(-10),
                RevokedAt = Now.AddDays(-1)
            });
        var json = SerialiseValidRequest();
        SetupDefaultDeserialiser(json);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task SubmitRequest_NotificationFails_StillStoresRequest()
    {
        _notificationService.NotifyNewRequestAsync(Arg.Any<Guid>(), Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Push failed"));
        var json = SerialiseValidRequest();
        SetupDefaultDeserialiser(json);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsSuccess.Should().BeTrue();
        await _pendingRequestRepo.Received(1).CreateAsync(Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitRequest_MultipleDevices_AllReceiveNotification()
    {
        _deviceTokenRepo.GetActiveByUserIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new List<Device> { CreateDevice(), CreateDevice(), CreateDevice() });
        var json = SerialiseValidRequest();
        SetupDefaultDeserialiser(json);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsSuccess.Should().BeTrue();
        await _notificationService.Received(1).NotifyNewRequestAsync(_userId, Arg.Any<PendingRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitRequest_InvalidJson_ReturnsError()
    {
        var json = "not valid json";
        _requestDeserialiser.Deserialise(json).Returns((DeserialisedRequest?)null);

        var result = await _sut.SubmitRequestAsync(_appRegistrationId, _userId, AppId, json);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    private string SerialiseValidRequest(
        string? userId = null,
        RequestType type = RequestType.Select,
        IReadOnlyList<RequestOption>? options = null,
        DateTimeOffset? expiry = null,
        string summary = "Approve payment",
        string? description = null,
        bool useDefaultExpiry = true,
        bool overrideDefaultOptions = false)
    {
        IReadOnlyList<RequestOption>? effectiveOptions;
        if (overrideDefaultOptions)
        {
            effectiveOptions = options;
        }
        else
        {
            effectiveOptions = options ?? (type is RequestType.Select or RequestType.Multiselect
                ? new[] { new RequestOption { Key = "yes", Label = "Yes" }, new RequestOption { Key = "no", Label = "No" } }
                : null);
        }

        var effectiveExpiry = useDefaultExpiry && expiry is null ? Now.AddMinutes(30) : expiry;

        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString(),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = AppId },
            Validation = new ValidationInfo { UserId = userId ?? _userId.ToString() },
            Action = new ActionInfo { Summary = summary, Description = description },
            Type = type,
            Options = effectiveOptions,
            Expiry = effectiveExpiry,
            CreatedAt = Now
        };

        return JsonSerializer.Serialize(request, JsonOptions);
    }

    private void SetupDefaultDeserialiser(string json)
    {
        SetupDeserialiserReturns(json, new DeserialisedRequest
        {
            UserId = _userId.ToString(), Summary = "Approve payment", Type = "Select", Expiry = Now.AddMinutes(30)
        });
    }

    private void SetupDeserialiserReturns(string json, DeserialisedRequest result)
    {
        _requestDeserialiser.Deserialise(json).Returns(result);
    }

    private static Device CreateDevice() => new()
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        Name = "Test Device",
        DeviceType = "mobile",
        DeviceToken = "ohpp_dev_test123",
        IsActive = true,
        RegisteredAt = DateTimeOffset.UtcNow
    };
}
