/// Crash-reporting seam for the OHPP client app (U7.1).
///
/// Mirrors the app's adaptive vendor pattern (interface + real impl + no-op):
/// - [CrashReporter] is the domain-level contract.
/// - SentryCrashReporter (sentry_crash_reporter.dart) reports to self-hosted
///   GlitchTip via the Sentry SDK; DSN via --dart-define=CRASH_DSN.
/// - [NoopCrashReporter] does nothing (tests / when CRASH_DSN is unset).
///
/// A PII/secret allowlist (NFR-S1) is enforced on context before it leaves the
/// device, matching the backend telemetry allowlist.
library;

/// Reports unhandled errors and crashes to the crash backend.
abstract class CrashReporter {
  /// Whether reporting is active (true only for a configured real reporter).
  bool get isEnabled;

  /// Record an error with its stack trace. Optional [context] is scrubbed by
  /// [CrashContextScrubber] before sending. Must never throw (fail-open).
  Future<void> recordError(
    Object error,
    StackTrace? stackTrace, {
    Map<String, String> context = const {},
    bool fatal = false,
  });
}

/// No-op crash reporter: used in tests and whenever CRASH_DSN is unset.
class NoopCrashReporter implements CrashReporter {
  const NoopCrashReporter();

  @override
  bool get isEnabled => false;

  @override
  Future<void> recordError(
    Object error,
    StackTrace? stackTrace, {
    Map<String, String> context = const {},
    bool fatal = false,
  }) async {}
}

/// Enforces the OHPP PII/secret allowlist on crash context (NFR-S1). Only
/// approved keys survive; anything else (tokens, emails, attestation payloads,
/// passwords) is dropped before the payload leaves the device.
class CrashContextScrubber {
  /// Keys permitted on crash context - kept aligned with the backend allowlist.
  static const Set<String> allowedKeys = {
    'ohpp.request_id',
    'ohpp.app_id',
    'ohpp.transaction_id',
    'ohpp.request_type',
    'screen',
    'auth_level',
  };

  /// Return only allowed, non-blank entries.
  static Map<String, String> scrub(Map<String, String> context) {
    final result = <String, String>{};
    context.forEach((key, value) {
      if (allowedKeys.contains(key) && value.trim().isNotEmpty) {
        result[key] = value;
      }
    });
    return result;
  }

  static bool isAllowed(String key) => allowedKeys.contains(key);
}
