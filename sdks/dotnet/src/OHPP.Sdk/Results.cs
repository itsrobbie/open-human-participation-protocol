using OHPP.Protocol;
using OHPP.Protocol.Models;

namespace OHPP.Sdk;

public sealed class ParticipationResult
{
    public bool Success { get; init; }
    public string? RequestId { get; init; }
    public string? Error { get; init; }
    public int? HttpStatusCode { get; init; }

    public static ParticipationResult Ok(string requestId) => new()
    {
        Success = true,
        RequestId = requestId
    };

    public static ParticipationResult Fail(string error, int? statusCode = null) => new()
    {
        Success = false,
        Error = error,
        HttpStatusCode = statusCode
    };
}

public sealed class RequestStatusResult
{
    public bool Success { get; init; }
    public RequestStatus? Status { get; init; }
    public AttestationEnvelope? Attestation { get; init; }
    public string? Error { get; init; }
    public int? HttpStatusCode { get; init; }

    public static RequestStatusResult Ok(RequestStatus status, AttestationEnvelope? attestation = null) => new()
    {
        Success = true,
        Status = status,
        Attestation = attestation
    };

    public static RequestStatusResult Fail(string error, int? statusCode = null) => new()
    {
        Success = false,
        Error = error,
        HttpStatusCode = statusCode
    };
}

public sealed class CancelResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public int? HttpStatusCode { get; init; }

    public static CancelResult Ok() => new() { Success = true };

    public static CancelResult Fail(string error, int? statusCode = null) => new()
    {
        Success = false,
        Error = error,
        HttpStatusCode = statusCode
    };
}

public sealed class VerificationResult
{
    public bool Valid { get; init; }
    public string? Error { get; init; }

    public static VerificationResult Verified() => new() { Valid = true };

    public static VerificationResult Invalid(string reason) => new()
    {
        Valid = false,
        Error = reason
    };
}
