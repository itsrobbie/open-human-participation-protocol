namespace OHPP.Infrastructure.OpenTelemetry;

/// <summary>
/// Pure, testable enrichment rules for OHPP telemetry (U7.1).
///
/// Two responsibilities, both technology-agnostic:
/// 1. Map OHPP correlation values (request id, app id, transaction id) to the
///    standard span/log attribute keys used across every service.
/// 2. Enforce the PII/secret allowlist (NFR-S1): only approved attribute keys
///    may be attached; anything else is dropped. This is the source-level
///    guard that pairs with the Collector-side redaction processor.
/// </summary>
public static class OhppTelemetryEnrichment
{
    // Standard attribute keys - identical across all services so signals correlate.
    public const string RequestIdKey = "ohpp.request_id";
    public const string AppIdKey = "ohpp.app_id";
    public const string TransactionIdKey = "ohpp.transaction_id";

    /// <summary>
    /// The complete set of attribute keys permitted on OHPP telemetry.
    /// Any key not in this set is stripped by <see cref="FilterAllowed"/>.
    /// Deliberately excludes tokens, attestation payloads, emails, passwords, etc.
    /// </summary>
    public static readonly IReadOnlySet<string> AllowedKeys = new HashSet<string>(StringComparer.Ordinal)
    {
        RequestIdKey,
        AppIdKey,
        TransactionIdKey,
        "ohpp.request_type",
        "ohpp.category",
        "ohpp.decision_type",
        // Standard OTel/HTTP keys that are safe and useful
        "service.name",
        "service.version",
        // U9: per-tenant identity so parallel stacks are separable in the shared
        // observability backend. Non-sensitive (stack id + env label only).
        "service.instance.id",
        "deployment.environment",
        "http.request.method",
        "http.response.status_code",
        "url.path",
    };

    /// <summary>
    /// Build the correlation attributes for a participation context. Only
    /// includes an attribute when its value is present and non-empty. Never
    /// emits null/blank values.
    /// </summary>
    public static IReadOnlyDictionary<string, string> BuildCorrelationAttributes(
        string? requestId = null,
        string? appId = null,
        string? transactionId = null)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(requestId)) result[RequestIdKey] = requestId;
        if (!string.IsNullOrWhiteSpace(appId)) result[AppIdKey] = appId;
        if (!string.IsNullOrWhiteSpace(transactionId)) result[TransactionIdKey] = transactionId;
        return result;
    }

    /// <summary>
    /// Filter an arbitrary attribute set down to only the allowed keys.
    /// This is the safety net that prevents PII/secrets from being attached
    /// to telemetry at the source.
    /// </summary>
    public static IReadOnlyDictionary<string, string> FilterAllowed(
        IReadOnlyDictionary<string, string> attributes)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var kvp in attributes)
        {
            if (AllowedKeys.Contains(kvp.Key) && !string.IsNullOrWhiteSpace(kvp.Value))
            {
                result[kvp.Key] = kvp.Value;
            }
        }
        return result;
    }

    /// <summary>
    /// True if the key is permitted on OHPP telemetry.
    /// </summary>
    public static bool IsAllowed(string key) => AllowedKeys.Contains(key);

    // Standard OpenTelemetry exception semantic-convention keys.
    public const string ExceptionTypeKey = "exception.type";
    public const string ExceptionMessageKey = "exception.message";
    public const string ExceptionStacktraceKey = "exception.stacktrace";

    /// <summary>
    /// Build the OTel exception event tags for an unhandled error, so a swallowed
    /// backend exception still surfaces as an error span in Grafana/Tempo (U7.1,
    /// Phase 4). Pure and testable; the middleware attaches these to the active span.
    /// </summary>
    public static IReadOnlyDictionary<string, string> BuildExceptionTags(Exception exception)
    {
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [ExceptionTypeKey] = exception.GetType().FullName ?? exception.GetType().Name,
            [ExceptionMessageKey] = exception.Message,
            [ExceptionStacktraceKey] = exception.ToString(),
        };
    }

    /// <summary>
    /// Pick the OHPP request id from a set of candidate route values (e.g. the
    /// route's {requestId} then {id}). Returns null when none is present/non-blank.
    /// </summary>
    public static string? ResolveRequestId(params string?[] candidates)
    {
        foreach (var c in candidates)
        {
            if (!string.IsNullOrWhiteSpace(c)) return c;
        }
        return null;
    }
}
