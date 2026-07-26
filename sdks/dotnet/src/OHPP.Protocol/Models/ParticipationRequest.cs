using System.Text.Json.Serialization;

namespace OHPP.Protocol.Models;

public sealed class ParticipationRequest
{
    public required string Id { get; init; }
    public required string Version { get; init; }
    public required RequesterInfo Requester { get; init; }
    public required ValidationInfo Validation { get; init; }
    public required ActionInfo Action { get; init; }
    public required RequestType Type { get; init; }
    public IReadOnlyList<RequestOption>? Options { get; init; }
    public string? Placeholder { get; init; }
    public bool Masked { get; init; }
    public string? Keyboard { get; init; }
    public InputValidation? InputValidation { get; init; }
    public DateTimeOffset? Expiry { get; init; }
    public TransactionInfo? Transaction { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public sealed class RequesterInfo
{
    public required string AppId { get; init; }
}

public sealed class ValidationInfo
{
    public required string UserId { get; init; }
}

public sealed class ActionInfo
{
    public required string Summary { get; init; }
    public string? Description { get; init; }
    public string? Rationale { get; init; }
    public string? Category { get; init; }
}

public sealed class RequestOption
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public bool FreeText { get; init; }
    public string? Placeholder { get; init; }
    public InputValidation? Validation { get; init; }
}

public sealed class InputValidation
{
    public bool Required { get; init; } = true;
    public double? Min { get; init; }
    public double? Max { get; init; }
    public string? Pattern { get; init; }
}

public sealed class TransactionInfo
{
    public required string Id { get; init; }
    public string? Label { get; init; }
}
