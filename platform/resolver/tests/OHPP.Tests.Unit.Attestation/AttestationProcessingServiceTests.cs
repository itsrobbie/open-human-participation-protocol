using System.Text.Json;
using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Services.Attestation;
using Xunit;

namespace OHPP.Tests.Unit.Attestation;

public class AttestationProcessingServiceTests
{
    private readonly IDeviceTokenRepository _deviceRepo = Substitute.For<IDeviceTokenRepository>();
    private readonly IPendingRequestRepository _pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
    private readonly IParticipationRecordRepository _recordRepo = Substitute.For<IParticipationRecordRepository>();
    private readonly ISignatureVerifier _signatureVerifier = Substitute.For<ISignatureVerifier>();
    private readonly ICounterSigningService _counterSigningService = Substitute.For<ICounterSigningService>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly AttestationProcessingService _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
    private readonly Guid _deviceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public AttestationProcessingServiceTests()
    {
        _clock.UtcNow.Returns(Now);
        _recordRepo.CreateAsync(Arg.Any<ParticipationRecord>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<ParticipationRecord>());
        _pendingRequestRepo.TryUpdateStatusAsync(
                Arg.Any<Guid>(), "Pending", "Resolved", Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>())
            .Returns(true);

        _sut = new AttestationProcessingService(
            _deviceRepo,
            _pendingRequestRepo,
            _recordRepo,
            _signatureVerifier,
            _counterSigningService,
            _clock);
    }

    [Fact]
    public async Task ProcessAttestation_ValidSignature_StoresAndCounterSigns()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);
        var deviceSignature = "valid-device-signature";
        var counterSignedEnvelope = "{\"envelope\":\"signed\"}";

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, deviceSignature, device.PublicKey!).Returns(true);
        _counterSigningService.CounterSignAsync(attestationPayload, deviceSignature, device.Id.ToString(), Arg.Any<CancellationToken>())
            .Returns(Result<string>.Success(counterSignedEnvelope));

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, deviceSignature);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(counterSignedEnvelope);
        await _pendingRequestRepo.Received(1).TryUpdateStatusAsync(
            request.Id, "Pending", "Resolved", Now, Arg.Any<CancellationToken>());
        await _recordRepo.Received(1).CreateAsync(
            Arg.Is<ParticipationRecord>(r => r.RequestId == request.Id && r.Status == "Resolved"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAttestation_InvalidDeviceSignature_ReturnsError()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);
        var deviceSignature = "invalid-signature";

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, deviceSignature, device.PublicKey!).Returns(false);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, deviceSignature);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ProcessAttestation_ConcurrentResolutionLost_ReturnsConflictWithoutRecord()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice(withPublicKey: true);
        var payload = CreateAttestationPayload(request.Id, "approve", Now);
        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(payload, "signature", device.PublicKey!).Returns(true);
        _counterSigningService.CounterSignAsync(payload, "signature", device.Id.ToString(), Arg.Any<CancellationToken>())
            .Returns(Result<string>.Success("counter-signed"));
        _pendingRequestRepo.TryUpdateStatusAsync(
                request.Id, "Pending", "Resolved", Now, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), payload, "signature");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
        await _recordRepo.DidNotReceive().CreateAsync(
            Arg.Any<ParticipationRecord>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAttestation_RequestNotPending_ReturnsConflict()
    {
        var request = CreatePendingRequest(status: "Resolved");
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task ProcessAttestation_RequestNotOwnedByUser_ReturnsNotFound()
    {
        var otherUserId = Guid.NewGuid();
        var request = CreatePendingRequest(userId: otherUserId);
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ProcessAttestation_RequestExpired_ReturnsConflict()
    {
        var request = CreatePendingRequest(status: "Expired");
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task ProcessAttestation_DuplicateSubmission_ReturnsConflict()
    {
        var request = CreatePendingRequest(status: "Resolved", resolvedAt: Now.AddMinutes(-1));
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("CONFLICT");
    }

    [Fact]
    public async Task ProcessAttestation_DecisionTimestampBeforeCreatedAt_ReturnsError()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice(withPublicKey: true);
        var decisionTime = request.CreatedAt.AddMinutes(-5);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", decisionTime);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, "sig", device.PublicKey!).Returns(true);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ProcessAttestation_DecisionTimestampAfterExpiry_ReturnsError()
    {
        var request = CreatePendingRequest(expiresAt: Now.AddMinutes(10));
        var device = CreateDevice(withPublicKey: true);
        var decisionTime = Now.AddMinutes(15);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", decisionTime);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, "sig", device.PublicKey!).Returns(true);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ProcessAttestation_SelectType_SelectedOptionNotInOriginalOptions_ReturnsError()
    {
        var request = CreatePendingRequest(type: "Select", requestPayload: JsonSerializer.Serialize(new
        {
            options = new[] { new { key = "yes", label = "Yes" }, new { key = "no", label = "No" } }
        }));
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayload(request.Id, "maybe", Now, type: "Select");

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, "sig", device.PublicKey!).Returns(true);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ProcessAttestation_TextType_ValueExceedsMaxLength_ReturnsError()
    {
        var request = CreatePendingRequest(type: "Text");
        var device = CreateDevice(withPublicKey: true);
        var longText = new string('x', 5001);
        var attestationPayload = CreateAttestationPayload(request.Id, longText, Now, type: "Text");

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, "sig", device.PublicKey!).Returns(true);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ProcessAttestation_DelegatedMethod_MissingDelegatedTo_ReturnsError()
    {
        var request = CreatePendingRequest(type: "Confirm");
        var device = CreateDevice(withPublicKey: true);
        var attestationPayload = CreateAttestationPayloadWithMethod(request.Id, "confirmed", Now, "Delegated", delegatedTo: null);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);
        _signatureVerifier.Verify(attestationPayload, "sig", device.PublicKey!).Returns(true);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ProcessAttestation_DeviceHasNoPublicKey_ReturnsError()
    {
        var request = CreatePendingRequest();
        var device = CreateDevice(withPublicKey: false);
        var attestationPayload = CreateAttestationPayload(request.Id, "approve", Now);

        _deviceRepo.GetByIdAsync(_deviceId, Arg.Any<CancellationToken>()).Returns(device);
        _pendingRequestRepo.GetByIdAsync(request.Id, Arg.Any<CancellationToken>()).Returns(request);

        var result = await _sut.ProcessDeviceAttestationAsync(
            _deviceId, _userId, request.Id.ToString(), attestationPayload, "sig");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    private PendingRequest CreatePendingRequest(
        string status = "Pending",
        Guid? userId = null,
        DateTimeOffset? expiresAt = null,
        DateTimeOffset? resolvedAt = null,
        string type = "Confirm",
        string? requestPayload = null) => new()
    {
        Id = Guid.NewGuid(),
        AppRegistrationId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        Status = status,
        RequestPayload = requestPayload ?? "{}",
        AppId = "bank.test",
        ActionSummary = "Approve payment",
        Type = type,
        CreatedAt = Now.AddMinutes(-10),
        ExpiresAt = expiresAt ?? Now.AddMinutes(30),
        ResolvedAt = resolvedAt
    };

    private Device CreateDevice(bool withPublicKey) => new()
    {
        Id = _deviceId,
        UserId = _userId,
        Name = "Test Phone",
        DeviceType = "mobile",
        PublicKey = withPublicKey ? "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----" : null,
        KeyAlgorithm = withPublicKey ? "ES256" : null,
        DeviceToken = "device-token-123",
        IsActive = true,
        RegisteredAt = Now.AddDays(-30)
    };

    private static string CreateAttestationPayload(Guid requestId, string decision, DateTimeOffset decisionTimestamp, string type = "Confirm")
    {
        var payload = new
        {
            requestId = requestId.ToString(),
            decision,
            decisionTimestamp = decisionTimestamp.ToString("o"),
            type
        };
        return JsonSerializer.Serialize(payload);
    }

    private static string CreateAttestationPayloadWithMethod(Guid requestId, string decision, DateTimeOffset decisionTimestamp, string method, string? delegatedTo)
    {
        var payload = new
        {
            requestId = requestId.ToString(),
            decision,
            decisionTimestamp = decisionTimestamp.ToString("o"),
            type = "Confirm",
            method,
            delegatedTo
        };
        return JsonSerializer.Serialize(payload);
    }
}
