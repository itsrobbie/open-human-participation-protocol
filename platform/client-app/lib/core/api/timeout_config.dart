/// Configurable timeouts per endpoint type.
/// Polling endpoints (pending, history): fast fail.
/// Submission endpoints (attestations, challenges): allow longer processing.
class TimeoutConfig {
  TimeoutConfig._();

  // Default (used if not overridden per-call)
  static const Duration defaultConnect = Duration(seconds: 10);
  static const Duration defaultRead = Duration(seconds: 30);

  // Polling endpoints: fail fast, show error quickly
  static const Duration pollingConnect = Duration(seconds: 5);
  static const Duration pollingRead = Duration(seconds: 15);

  // Submission endpoints: allow server processing time
  static const Duration submissionConnect = Duration(seconds: 10);
  static const Duration submissionRead = Duration(seconds: 30);

  // SSE: streaming connection, no read timeout
  static const Duration sseConnect = Duration(seconds: 5);
}
