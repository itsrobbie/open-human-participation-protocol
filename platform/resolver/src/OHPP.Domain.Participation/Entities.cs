namespace OHPP.Domain.Participation;

public sealed class PendingRequest
{
    public Guid Id { get; set; }
    public Guid AppRegistrationId { get; set; }
    public Guid UserId { get; set; }
    public required string Status { get; set; }
    public required string RequestPayload { get; set; }
    public required string AppId { get; set; }
    public required string ActionSummary { get; set; }
    public required string Type { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}

public sealed class DeviceParticipationRequest
{
    public required Guid RequestId { get; init; }
    public required string AppId { get; init; }
    public required string Summary { get; init; }
    public string? Description { get; init; }
    public string? Rationale { get; init; }
    public string? Category { get; init; }
    public required string Type { get; init; }
    public IReadOnlyList<DeviceRequestOption>? Options { get; init; }
    public DateTimeOffset? Expiry { get; init; }
    public DateTimeOffset ReceivedAt { get; init; }
}

public sealed class DeviceRequestOption
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public bool FreeText { get; init; }
    public string? Placeholder { get; init; }
}

public sealed class ParticipationRecord
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public Guid UserId { get; set; }
    public Guid AppRegistrationId { get; set; }
    public required string Status { get; set; }
    public required string AppId { get; set; }
    public required string AppName { get; set; }
    public required string ActionSummary { get; set; }
    public required string Type { get; set; }
    public string? Category { get; set; }
    public string? DecisionPayload { get; set; }
    public string? AttestationPayload { get; set; }
    public string? ResolutionMethod { get; set; }
    public Guid? ResolvingDeviceId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}
