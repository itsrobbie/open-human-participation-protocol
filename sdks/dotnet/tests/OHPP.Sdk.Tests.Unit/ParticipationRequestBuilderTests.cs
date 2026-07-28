using FluentAssertions;
using OHPP.Protocol;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class ParticipationRequestBuilderTests
{
    [Fact]
    public void BuildRequest_AllFieldsSet_ProducesValidRequest()
    {
        var request = new ParticipationRequestBuilder()
            .ForUser("user-123")
            .FromApp("pizza.example.com")
            .WithSummary("Confirm pizza order")
            .WithDescription("You are about to order a **large pepperoni** pizza")
            .WithRationale("This costs $18.99")
            .WithCategory("purchase")
            .OfType(RequestType.Select)
            .AddOption("confirm", "Confirm order")
            .AddOption("cancel", "Cancel")
            .ExpiresIn(TimeSpan.FromMinutes(10))
            .InTransaction("txn-456", "Pizza Order")
            .Build();

        request.Id.Should().NotBeNullOrWhiteSpace();
        request.Version.Should().Be(ProtocolConstants.Version);
        request.Requester.AppId.Should().Be("pizza.example.com");
        request.Validation.UserId.Should().Be("user-123");
        request.Action.Summary.Should().Be("Confirm pizza order");
        request.Action.Description.Should().Contain("large pepperoni");
        request.Action.Rationale.Should().Be("This costs $18.99");
        request.Action.Category.Should().Be("purchase");
        request.Type.Should().Be(RequestType.Select);
        request.Options.Should().HaveCount(2);
        request.Options![0].Key.Should().Be("confirm");
        request.Options[1].Key.Should().Be("cancel");
        request.Expiry.Should().NotBeNull();
        request.Transaction.Should().NotBeNull();
        request.Transaction!.Id.Should().Be("txn-456");
        request.Transaction.Label.Should().Be("Pizza Order");
        request.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void BuildRequest_MissingUserId_Throws()
    {
        var builder = new ParticipationRequestBuilder()
            .FromApp("pizza.example.com")
            .WithSummary("Test");

        var act = () => builder.Build();

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*userId*");
    }

    [Fact]
    public void BuildRequest_MissingAppId_Throws()
    {
        var builder = new ParticipationRequestBuilder()
            .ForUser("user-123")
            .WithSummary("Test");

        var act = () => builder.Build();

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*appId*");
    }

    [Fact]
    public void BuildRequest_MissingSummary_Throws()
    {
        var builder = new ParticipationRequestBuilder()
            .ForUser("user-123")
            .FromApp("pizza.example.com");

        var act = () => builder.Build();

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*summary*");
    }

    [Fact]
    public void BuildRequest_TextType_NoOptions_Succeeds()
    {
        var request = new ParticipationRequestBuilder()
            .ForUser("user-123")
            .FromApp("bank.example.com")
            .WithSummary("Enter PIN")
            .OfType(RequestType.Text)
            .AsMasked()
            .WithKeyboard("numeric")
            .WithPlaceholder("4 digits")
            .Build();

        request.Type.Should().Be(RequestType.Text);
        request.Options.Should().BeNull();
        request.Masked.Should().BeTrue();
        request.Keyboard.Should().Be("numeric");
        request.Placeholder.Should().Be("4 digits");
    }

    [Fact]
    public void BuildRequest_GeneratesUniqueIds()
    {
        var builder = () => new ParticipationRequestBuilder()
            .ForUser("user-123")
            .FromApp("app.test")
            .WithSummary("Test")
            .OfType(RequestType.Text)
            .Build();

        var ids = Enumerable.Range(0, 100).Select(_ => builder().Id).ToHashSet();
        ids.Should().HaveCount(100);
    }
}
