/// Product-analytics seam for the OHPP client app (U7.1).
///
/// Mirrors the app's adaptive vendor pattern (interface + real impl + no-op):
/// - [AnalyticsSink] is the domain-level contract.
/// - UmamiAnalyticsSink (umami_analytics_sink.dart) POSTs events to self-hosted
///   Umami's /api/send; host/key via --dart-define (ANALYTICS_HOST /
///   ANALYTICS_KEY, where ANALYTICS_KEY is the Umami website UUID).
/// - [NoopAnalyticsSink] does nothing (tests / when unconfigured).
///
/// Properties must contain NO PII (NFR-S1); use only allowlisted keys.
library;

/// The minimal shared analytics taxonomy (Q4). These are the only events the
/// client emits; property maps carry non-PII context only.
class AnalyticsEvent {
  static const String appOpened = 'app_opened';
  static const String requestReceived = 'request_received';
  static const String requestResponded = 'request_responded';
  static const String requestExpired = 'request_expired';
  static const String errorShown = 'error_shown';
}

/// Captures product-analytics events.
abstract class AnalyticsSink {
  /// Whether analytics is active (true only for a configured real sink).
  bool get isEnabled;

  /// Capture an event with optional non-PII properties. Must never throw.
  Future<void> capture(String event, {Map<String, Object> properties = const {}});
}

/// No-op analytics sink: used in tests and whenever analytics is unconfigured.
class NoopAnalyticsSink implements AnalyticsSink {
  const NoopAnalyticsSink();

  @override
  bool get isEnabled => false;

  @override
  Future<void> capture(String event, {Map<String, Object> properties = const {}}) async {}
}

/// Enforces the analytics property allowlist (NFR-S1): drops any key that could
/// carry PII/secrets before an event leaves the device.
class AnalyticsPropertyScrubber {
  static const Set<String> allowedKeys = {
    'request_type',
    'category',
    'decision',
    'auth_level',
    'screen',
    'queued',
    'reason',
  };

  static Map<String, Object> scrub(Map<String, Object> properties) {
    final result = <String, Object>{};
    properties.forEach((key, value) {
      if (allowedKeys.contains(key)) {
        result[key] = value;
      }
    });
    return result;
  }

  static bool isAllowed(String key) => allowedKeys.contains(key);
}
