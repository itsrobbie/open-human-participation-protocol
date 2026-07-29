namespace Bank.Domain;

public sealed class Account
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public decimal Balance { get; set; }
    public List<Payee> Payees { get; init; } = new();
    public OhppRegistration? OhppRegistration { get; set; }
}

public sealed class Payee
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string AccountNumber { get; init; }
    public required string SortCode { get; init; }
}

public sealed class TransferRequest
{
    public required string FromAccountId { get; init; }
    public required string ToPayeeId { get; init; }
    public required decimal Amount { get; init; }
    public string? Reference { get; init; }
}

public sealed class AddPayeeRequest
{
    public required string AccountId { get; init; }
    public required string Name { get; init; }
    public required string AccountNumber { get; init; }
    public required string SortCode { get; init; }
}

/// <summary>
/// Tracks OHPP registration for a bank account (resolver URL + access token).
/// </summary>
public sealed class OhppRegistration
{
    public required string ResolverUrl { get; init; }
    public required string AccessToken { get; init; }
    public required string UserId { get; init; }
}

public sealed class TransferResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public string? ParticipationRequestId { get; init; }
    public TransferStatus Status { get; init; }

    public static TransferResult Completed() => new() { Success = true, Status = TransferStatus.Completed };
    public static TransferResult PendingApproval(string requestId) => new() { Success = true, Status = TransferStatus.PendingApproval, ParticipationRequestId = requestId };
    public static TransferResult Denied(string reason) => new() { Success = false, Status = TransferStatus.Denied, Error = reason };
    public static TransferResult Failed(string error) => new() { Success = false, Status = TransferStatus.Failed, Error = error };
}

public enum TransferStatus
{
    Completed,
    PendingApproval,
    Denied,
    Failed,
    Expired
}

/// <summary>
/// A record of a transfer attempt and its outcome.
/// </summary>
public sealed class TransactionRecord
{
    public required string Id { get; init; }
    public required string AccountId { get; init; }
    public required string PayeeName { get; init; }
    public required decimal Amount { get; init; }
    public string? Reference { get; init; }
    public required TransferStatus Status { get; set; }
    public string? ParticipationRequestId { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ResolvedAt { get; set; }
}
