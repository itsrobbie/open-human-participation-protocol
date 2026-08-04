using FluentAssertions;
using InsuranceClaims.Domain;
using Xunit;
using InsuranceClaims.Services;

namespace InsuranceClaims.Tests.Unit;

public sealed class ScenarioBuilderTests
{
    [Theory]
    [InlineData(ClaimScenario.SelectDisposition, "Select")]
    [InlineData(ClaimScenario.AffectedItems, "Multiselect")]
    [InlineData(ClaimScenario.ClaimantNote, "Text")]
    [InlineData(ClaimScenario.EstimatedAmount, "Number")]
    [InlineData(ClaimScenario.IncidentDate, "Date")]
    [InlineData(ClaimScenario.AdjusterAppointment, "DateTime")]
    [InlineData(ClaimScenario.ClaimantDeclaration, "Signature")]
    public void BuildScenario_EachProtocolType_ProducesAppDefinedScenario(ClaimScenario scenario, string expectedType)
    {
        var result = ParticipationScenarioCatalog.Get(scenario);

        result.RequestType.ToString().Should().Be(expectedType);
        result.Summary.Should().NotBeNullOrWhiteSpace();
        result.Description.Should().NotBeNullOrWhiteSpace();
        result.Options.Should().NotBeEmpty();
    }

    [Fact]
    public void BuildScenario_UnknownScenario_Throws()
    {
        var action = () => ParticipationScenarioCatalog.Get((ClaimScenario)999);

        action.Should().Throw<ArgumentOutOfRangeException>();
    }
}
