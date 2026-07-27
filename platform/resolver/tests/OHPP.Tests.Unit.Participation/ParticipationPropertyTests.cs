using FsCheck;
using FsCheck.Xunit;
using NSubstitute;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Validation;
using OHPP.Services.Participation;

namespace OHPP.Tests.Unit.Participation;

public class ParticipationPropertyTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);

    [Property]
    public bool PBT_RequestValidation_AllInvalidPayloads_AlwaysReject(PositiveInt summaryLength)
    {
        // Any request with a summary exceeding max length is always rejected
        var oversizedSummary = new string('x', ProtocolConstants.MaxLengths.Summary + summaryLength.Get);

        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString(),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "test.app" },
            Validation = new ValidationInfo { UserId = Guid.NewGuid().ToString() },
            Action = new ActionInfo { Summary = oversizedSummary },
            Type = RequestType.Select,
            Options = new[] { new RequestOption { Key = "a", Label = "A" }, new RequestOption { Key = "b", Label = "B" } },
            Expiry = Now.AddMinutes(30),
            CreatedAt = Now
        };

        var errors = ParticipationRequestValidator.Validate(request, Now);
        return errors.Count > 0;
    }

    [Property]
    public bool PBT_RequestValidation_AllValidPayloads_AlwaysAccept(byte summaryVariant)
    {
        // A well-formed request with valid summary length always passes validation
        var summaryLength = Math.Max(1, summaryVariant % ProtocolConstants.MaxLengths.Summary);
        var summary = new string('A', summaryLength);

        var request = new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString(),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = "test.app" },
            Validation = new ValidationInfo { UserId = Guid.NewGuid().ToString() },
            Action = new ActionInfo { Summary = summary },
            Type = RequestType.Select,
            Options = new[] { new RequestOption { Key = "yes", Label = "Yes" }, new RequestOption { Key = "no", Label = "No" } },
            Expiry = Now.AddMinutes(30),
            CreatedAt = Now
        };

        var errors = ParticipationRequestValidator.Validate(request, Now);
        return errors.Count == 0;
    }

    [Property]
    public bool PBT_StateTransitions_OnlyPendingCanTransition(byte statusIndex)
    {
        // Only requests in "Pending" state should be transitionable
        var statuses = new[] { "Pending", "Resolved", "Expired", "Cancelled" };
        var status = statuses[statusIndex % statuses.Length];

        var clock = Substitute.For<IClock>();
        clock.UtcNow.Returns(Now);

        var pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
        var recordRepo = Substitute.For<IParticipationRecordRepository>();
        var expiryService = Substitute.For<IExpiryEnforcementService>();
        var channel = Substitute.For<INotificationChannel>();

        expiryService.CheckAndExpireIfNeeded(Arg.Any<PendingRequest>()).Returns(false);
        recordRepo.CreateAsync(Arg.Any<ParticipationRecord>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.Arg<ParticipationRecord>());

        var appRegId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        var request = new PendingRequest
        {
            Id = requestId,
            AppRegistrationId = appRegId,
            UserId = Guid.NewGuid(),
            Status = status,
            RequestPayload = "{}",
            AppId = "bank.test",
            ActionSummary = "Test",
            Type = "Select",
            CreatedAt = Now.AddMinutes(-10),
            ExpiresAt = Now.AddMinutes(30),
            ResolvedAt = status != "Pending" ? Now.AddMinutes(-1) : null
        };

        pendingRequestRepo.GetByIdForAppAsync(requestId, appRegId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<PendingRequest?>(request));

        var sut = new RequestLifecycleManager(pendingRequestRepo, recordRepo, expiryService, channel, clock);
        var result = sut.CancelRequestAsync(requestId, appRegId, CancellationToken.None).GetAwaiter().GetResult();

        if (status == "Pending")
            return result.IsSuccess;
        else
            return result.IsFailure && result.Error!.Code == "CONFLICT";
    }

    [Property]
    public bool PBT_ExpiryCheck_Idempotent_MultipleApplications_SameResult(byte applications)
    {
        // Running CheckAndExpireIfNeeded multiple times should give the same result
        var clock = Substitute.For<IClock>();
        clock.UtcNow.Returns(Now);

        var pendingRequestRepo = Substitute.For<IPendingRequestRepository>();
        var recordRepo = Substitute.For<IParticipationRecordRepository>();
        var channel = Substitute.For<INotificationChannel>();

        var sut = new ExpiryEnforcementService(pendingRequestRepo, recordRepo, channel, clock);

        var request = new PendingRequest
        {
            Id = Guid.NewGuid(),
            AppRegistrationId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Status = "Pending",
            RequestPayload = "{}",
            AppId = "bank.test",
            ActionSummary = "Test",
            Type = "Select",
            CreatedAt = Now.AddMinutes(-30),
            ExpiresAt = Now.AddMinutes(-5),
            ResolvedAt = null
        };

        var timesToApply = Math.Max(1, applications % 20);
        var firstResult = sut.CheckAndExpireIfNeeded(request);

        for (var i = 1; i < timesToApply; i++)
        {
            var subsequentResult = sut.CheckAndExpireIfNeeded(request);
            if (subsequentResult != firstResult)
                return false;
        }

        return firstResult;
    }
}
