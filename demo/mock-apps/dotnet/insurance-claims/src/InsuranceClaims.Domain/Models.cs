using OHPP.Protocol;

namespace InsuranceClaims.Domain;

public enum PolicyStatus
{
    Active,
    Expired,
    Cancelled
}

public enum ClaimStatus
{
    Draft,
    Submitted,
    AwaitingParticipation,
    MoreInformationRequired,
    Escalated,
    InReview,
    ApprovedForNextStep,
    Closed,
    Expired,
    Cancelled
}

public sealed record InsurancePolicy
{
    public required string Id { get; init; }
    public required string PolicyNumber { get; init; }
    public required string CustomerName { get; init; }
    public decimal CoverageLimit { get; init; }
    public DateOnly ValidFrom { get; init; }
    public DateOnly ValidTo { get; init; }
    public PolicyStatus Status { get; init; }
}

public sealed record InsuranceClaim
{
    public required string Id { get; init; }
    public required string UserId { get; init; }
    public required string PolicyId { get; init; }
    public required string ClaimNumber { get; init; }
    public required string ClaimantName { get; init; }
    public DateOnly IncidentDate { get; set; }
    public DateTimeOffset IncidentAt { get; init; }
    public required string Description { get; init; }
    public IReadOnlyList<ClaimNote> Notes { get; init; } = [];
    public IReadOnlyList<string> AffectedItems { get; init; } = [];
    public decimal EstimatedAmount { get; set; }
    public ClaimStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? ParticipationRequestId { get; set; }
    public ClaimScenario? ParticipationScenario { get; set; }
    public string? SelectedOption { get; set; }
    public IReadOnlyList<string>? SelectedOptions { get; set; }
    public string? AnswerValue { get; set; }
    public string? AttestationPayload { get; set; }
}

public sealed record ClaimNote
{
    public required string Id { get; init; }
    public required string AuthorType { get; init; }
    public required string Body { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public enum ClaimScenario
{
    SelectDisposition,
    AffectedItems,
    ClaimantNote,
    EstimatedAmount,
    IncidentDate,
    AdjusterAppointment,
    ClaimantDeclaration
}

public sealed record ParticipationScenario
{
    public required ClaimScenario Scenario { get; init; }
    public required RequestType RequestType { get; init; }
    public required string Summary { get; init; }
    public required string Description { get; init; }
    public required IReadOnlyList<ScenarioOption> Options { get; init; }
}

public sealed record ScenarioOption
{
    public required string Key { get; init; }
    public required string Label { get; init; }
}

public sealed record ClaimOperationResult(bool IsSuccess, string? Error = null, string? RequestId = null)
{
    public static ClaimOperationResult Success(string? requestId = null) => new(true, RequestId: requestId);
    public static ClaimOperationResult Failure(string error) => new(false, error);
}

public static class ParticipationScenarioCatalog
{
    public static IReadOnlyList<ParticipationScenario> All => Enum.GetValues<ClaimScenario>().Select(Get).ToArray();

    public static ParticipationScenario Get(ClaimScenario scenario) => scenario switch
    {
        ClaimScenario.SelectDisposition => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Select,
            Summary = "Choose the next claim handling action",
            Description = "Select the next action for this insurance claim.",
            Options = Options(("continue", "Continue"), ("more-information", "Request More Information"), ("escalate", "Escalate"))
        },
        ClaimScenario.AffectedItems => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Multiselect,
            Summary = "Confirm affected items",
            Description = "Select each item involved in the claim.",
            Options = Options(("building", "Building"), ("contents", "Contents"), ("temporary-accommodation", "Temporary accommodation"))
        },
        ClaimScenario.ClaimantNote => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Text,
            Summary = "Add a claimant note",
            Description = "Provide any additional information for the claim reviewer.",
            Options = Options(("note", "Claimant note"))
        },
        ClaimScenario.EstimatedAmount => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Number,
            Summary = "Confirm the estimated claim amount",
            Description = "Enter the current estimated amount for the claim.",
            Options = Options(("amount", "Estimated amount"))
        },
        ClaimScenario.IncidentDate => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Date,
            Summary = "Confirm the incident date",
            Description = "Enter the date on which the incident occurred.",
            Options = Options(("incident-date", "Incident date"))
        },
        ClaimScenario.AdjusterAppointment => new()
        {
            Scenario = scenario,
            RequestType = RequestType.DateTime,
            Summary = "Choose an adjuster appointment",
            Description = "Select a date and time for the adjuster appointment.",
            Options = Options(("appointment", "Adjuster appointment"))
        },
        ClaimScenario.ClaimantDeclaration => new()
        {
            Scenario = scenario,
            RequestType = RequestType.Signature,
            Summary = "Sign the claimant declaration",
            Description = "Confirm the claimant declaration for this claim.",
            Options = Options(("signed", "I confirm this declaration"))
        },
        _ => throw new ArgumentOutOfRangeException(nameof(scenario), scenario, "Unknown claim scenario")
    };

    private static IReadOnlyList<ScenarioOption> Options(params (string Key, string Label)[] options) =>
        options.Select(option => new ScenarioOption { Key = option.Key, Label = option.Label }).ToArray();
}
