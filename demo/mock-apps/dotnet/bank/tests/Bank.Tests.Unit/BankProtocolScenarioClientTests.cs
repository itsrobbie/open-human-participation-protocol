using Bank.Domain;
using Bank.Infrastructure;
using FluentAssertions;
using NSubstitute;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class BankProtocolScenarioClientTests
{
    [Theory]
    [InlineData(BankProtocolScenario.TransferDecision, RequestType.Select)]
    [InlineData(BankProtocolScenario.TransferControls, RequestType.Multiselect)]
    [InlineData(BankProtocolScenario.PaymentReference, RequestType.Text)]
    [InlineData(BankProtocolScenario.TransferAmount, RequestType.Number)]
    [InlineData(BankProtocolScenario.PaymentDate, RequestType.Date)]
    [InlineData(BankProtocolScenario.PaymentDateTime, RequestType.DateTime)]
    [InlineData(BankProtocolScenario.HighValueAcknowledgement, RequestType.Signature)]
    public async Task CreateAsync_EachScenario_UsesExpectedProtocolType(
        BankProtocolScenario scenario,
        RequestType expectedType)
    {
        var requester = Substitute.For<IOhppRequesterClient>();
        ParticipationRequest? sent = null;
        requester.SendRequestAsync(
                Arg.Do<ParticipationRequest>(request => sent = request),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(ParticipationResult.Ok("request-1"));
        var client = new BankProtocolScenarioClient(requester, "bank.test");

        var result = await client.CreateAsync(Registration(), scenario);

        result.Success.Should().BeTrue();
        sent.Should().NotBeNull();
        sent!.Type.Should().Be(expectedType);
        if (expectedType is RequestType.Select or RequestType.Multiselect)
            sent.Options.Should().NotBeEmpty();
        else
            sent.Options.Should().BeNullOrEmpty();
    }

    private static OhppRegistration Registration() => new()
    {
        ResolverUrl = "http://resolver.test",
        AccessToken = "token",
        UserId = "demo-user"
    };
}
