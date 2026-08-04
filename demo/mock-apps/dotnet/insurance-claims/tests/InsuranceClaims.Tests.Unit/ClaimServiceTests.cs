using FluentAssertions;
using NSubstitute;
using InsuranceClaims.Domain;
using InsuranceClaims.Services;
using OHPP.Protocol;
using Xunit;

namespace InsuranceClaims.Tests.Unit;

public sealed class ClaimServiceTests
{
    private readonly IClaimRepository _claims = Substitute.For<IClaimRepository>();
    private readonly IPolicyRepository _policies = Substitute.For<IPolicyRepository>();
    private readonly IParticipationClient _participation = Substitute.For<IParticipationClient>();
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly ClaimService _service;

    public ClaimServiceTests()
    {
        _clock.UtcNow.Returns(new DateTimeOffset(2026, 7, 31, 10, 0, 0, TimeSpan.Zero));
        _service = new ClaimService(_claims, _policies, _participation, _clock);
    }

    [Fact]
    public async Task SubmitClaim_ValidDraft_SubmitsClaim()
    {
        var claim = TestData.ValidClaim();
        _policies.GetAsync(claim.PolicyId, claim.UserId, Arg.Any<CancellationToken>()).Returns(TestData.Policy());

        var result = await _service.SubmitAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.Submitted);
        await _claims.Received(1).SaveAsync(claim, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitClaim_MissingPolicy_RejectsClaim()
    {
        var claim = TestData.ValidClaim();
        _policies.GetAsync(claim.PolicyId, claim.UserId, Arg.Any<CancellationToken>()).Returns((InsurancePolicy?)null);

        var result = await _service.SubmitAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("policy");
        await _claims.DidNotReceive().SaveAsync(Arg.Any<InsuranceClaim>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitClaim_FutureIncidentDate_RejectsClaim()
    {
        var claim = TestData.ValidClaim() with { IncidentDate = DateOnly.FromDateTime(_clock.UtcNow.AddDays(1).Date) };
        _policies.GetAsync(claim.PolicyId, claim.UserId, Arg.Any<CancellationToken>()).Returns(TestData.Policy());

        var result = await _service.SubmitAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("future");
    }

    [Fact]
    public async Task SubmitClaim_NonPositiveEstimate_RejectsClaim()
    {
        var claim = TestData.ValidClaim() with { EstimatedAmount = 0m };
        _policies.GetAsync(claim.PolicyId, claim.UserId, Arg.Any<CancellationToken>()).Returns(TestData.Policy());

        var result = await _service.SubmitAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("amount");
    }

    [Fact]
    public async Task CreateParticipation_ValidClaim_CreatesParticipationRequest()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.Submitted };
        _participation.RequestAsync(claim, Arg.Any<ParticipationScenario>(), Arg.Any<CancellationToken>())
            .Returns(new ParticipationRequestResult(true, "request-1"));

        var result = await _service.CreateParticipationAsync(claim, ClaimScenario.SelectDisposition, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.RequestId.Should().Be("request-1");
        claim.Status.Should().Be(ClaimStatus.AwaitingParticipation);
        await _claims.Received(1).SaveAsync(claim, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(ClaimScenario.SelectDisposition, RequestType.Select)]
    [InlineData(ClaimScenario.AffectedItems, RequestType.Multiselect)]
    [InlineData(ClaimScenario.ClaimantNote, RequestType.Text)]
    [InlineData(ClaimScenario.EstimatedAmount, RequestType.Number)]
    [InlineData(ClaimScenario.IncidentDate, RequestType.Date)]
    [InlineData(ClaimScenario.AdjusterAppointment, RequestType.DateTime)]
    [InlineData(ClaimScenario.ClaimantDeclaration, RequestType.Signature)]
    public async Task CreateParticipation_EachScenario_DelegatesToRequesterSdk(ClaimScenario scenario, RequestType requestType)
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.Submitted };
        _participation.RequestAsync(claim, Arg.Any<ParticipationScenario>(), Arg.Any<CancellationToken>())
            .Returns(new ParticipationRequestResult(true, "request-1"));

        var result = await _service.CreateParticipationAsync(claim, scenario, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _participation.Received(1).RequestAsync(
            claim,
            Arg.Is<ParticipationScenario>(value => value.RequestType == requestType),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAnswer_ContinueAnswer_AdvancesClaim()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.AwaitingParticipation };

        var result = await _service.ApplyAnswerAsync(claim, "continue", null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.ApprovedForNextStep);
    }

    [Fact]
    public async Task ApplyAnswer_RequestMoreInformationAnswer_PausesClaim()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.AwaitingParticipation };

        var result = await _service.ApplyAnswerAsync(claim, "more-information", null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.MoreInformationRequired);
    }

    [Fact]
    public async Task ApplyAnswer_EscalateAnswer_MovesClaimToEscalated()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.AwaitingParticipation };

        var result = await _service.ApplyAnswerAsync(claim, "escalate", null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.Escalated);
    }

    [Fact]
    public async Task ApplyAnswer_UnofferedAnswer_IsRejected()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.AwaitingParticipation };

        var result = await _service.ApplyAnswerAsync(claim, "approve", null, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        claim.Status.Should().Be(ClaimStatus.AwaitingParticipation);
    }

    [Fact]
    public async Task ApplyAnswer_DuplicateResolution_DoesNotAdvanceClaimTwice()
    {
        var claim = TestData.ValidClaim() with { Status = ClaimStatus.AwaitingParticipation };

        var first = await _service.ApplyAnswerAsync(claim, "continue", null, CancellationToken.None);
        var second = await _service.ApplyAnswerAsync(claim, "continue", null, CancellationToken.None);

        first.IsSuccess.Should().BeTrue();
        second.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.ApprovedForNextStep);
        await _claims.Received(1).SaveAsync(claim, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshParticipation_ExpiredRequest_MarksClaimExpired()
    {
        var claim = TestData.ValidClaim() with
        {
            Status = ClaimStatus.AwaitingParticipation,
            ParticipationRequestId = "request-1",
            ParticipationScenario = ClaimScenario.SelectDisposition
        };
        _participation.GetStatusAsync("request-1", claim.UserId, Arg.Any<CancellationToken>())
            .Returns(new ParticipationStatus(false, IsExpired: true));

        var result = await _service.RefreshParticipationAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.Expired);
        await _claims.Received(1).SaveAsync(claim, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshParticipation_SignatureAnswer_RecordsDeclaration()
    {
        var claim = TestData.ValidClaim() with
        {
            Status = ClaimStatus.AwaitingParticipation,
            ParticipationRequestId = "request-1",
            ParticipationScenario = ClaimScenario.ClaimantDeclaration
        };
        _participation.GetStatusAsync("request-1", claim.UserId, Arg.Any<CancellationToken>())
            .Returns(new ParticipationStatus(
                true,
                Value: "acknowledged",
                AttestationPayload: "signed-attestation"));

        var result = await _service.RefreshParticipationAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        claim.Status.Should().Be(ClaimStatus.ApprovedForNextStep);
        claim.AnswerValue.Should().Be("acknowledged");
        claim.AttestationPayload.Should().Be("signed-attestation");
    }

    [Fact]
    public async Task RefreshParticipation_InvalidAttestation_DoesNotApplyAnswer()
    {
        var claim = TestData.ValidClaim() with
        {
            Status = ClaimStatus.AwaitingParticipation,
            ParticipationRequestId = "request-1",
            ParticipationScenario = ClaimScenario.SelectDisposition
        };
        _participation.GetStatusAsync("request-1", claim.UserId, Arg.Any<CancellationToken>())
            .Returns(new ParticipationStatus(
                true,
                SelectedOption: "continue",
                IsAttestationValid: false,
                AttestationError: "Outer signature verification failed"));

        var result = await _service.RefreshParticipationAsync(claim, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("attestation");
        claim.Status.Should().Be(ClaimStatus.AwaitingParticipation);
        await _claims.DidNotReceive().SaveAsync(claim, Arg.Any<CancellationToken>());
    }

    private static class TestData
    {
        public static InsuranceClaim ValidClaim() => new()
        {
            Id = "claim-1",
            UserId = "demo-user",
            PolicyId = "policy-1",
            ClaimNumber = "CLM-0001",
            ClaimantName = "Demo User",
            IncidentDate = new DateOnly(2026, 7, 30),
            IncidentAt = new DateTimeOffset(2026, 7, 30, 12, 0, 0, TimeSpan.Zero),
            Description = "Water damage",
            EstimatedAmount = 1250m,
            Status = ClaimStatus.Draft,
            CreatedAt = new DateTimeOffset(2026, 7, 30, 12, 0, 0, TimeSpan.Zero),
            UpdatedAt = new DateTimeOffset(2026, 7, 30, 12, 0, 0, TimeSpan.Zero)
        };

        public static InsurancePolicy Policy() => new()
        {
            Id = "policy-1",
            PolicyNumber = "POL-0001",
            CustomerName = "Demo User",
            CoverageLimit = 10000m,
            ValidFrom = new DateOnly(2026, 1, 1),
            ValidTo = new DateOnly(2026, 12, 31),
            Status = PolicyStatus.Active
        };
    }
}
