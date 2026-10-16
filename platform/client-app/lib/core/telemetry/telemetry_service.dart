/// Telemetry seam for the OHPP client app (U7.1).
///
/// Mirrors the app's adaptive vendor pattern (interface + real impl + no-op):
/// - [TelemetryService] is the domain-level contract.
/// - [OtlpTelemetryService] exports spans to the OpenTelemetry Collector over
///   OTLP/HTTP (see otlp_telemetry_service.dart).
/// - [NoopTelemetryService] does nothing (tests / when OTEL_ENDPOINT is unset).
///
/// Config-driven and fail-open: nothing here ever throws into the app path.
/// The exporter is selected in main.dart from the OTEL_ENDPOINT dart-define.
library;

/// A finished span to be exported. Kept minimal and technology-agnostic so the
/// no-op and OTLP implementations share one contract and unit tests are trivial.
class TelemetrySpan {
  /// Operation name, e.g. "api.submitAttestation" or "screen.pending".
  final String name;

  /// Span start / end. Duration is end - start.
  final DateTime startTime;
  final DateTime endTime;

  /// True if the operation failed (sets OTel span status = error on export).
  final bool isError;

  /// Attributes to attach. Only OHPP-allowlisted keys should be passed; the
  /// exporter does not scrub, so callers use the helpers on this class.
  final Map<String, String> attributes;

  const TelemetrySpan({
    required this.name,
    required this.startTime,
    required this.endTime,
    this.isError = false,
    this.attributes = const {},
  });
}

/// Records spans for export to the observability backend.
abstract class TelemetryService {
  /// Whether telemetry export is active (true only for a configured OTLP impl).
  bool get isEnabled;

  /// Record a completed span. Must never throw (fail-open).
  Future<void> recordSpan(TelemetrySpan span);

  /// Convenience: time an operation and record a span named [name], stamping the
  /// OHPP request id when provided. Returns the operation's result; a thrown
  /// error is recorded as an error span and rethrown (the app decides handling).
  Future<T> trace<T>(
    String name,
    Future<T> Function() operation, {
    String? requestId,
    Map<String, String> attributes = const {},
  });

  /// Flush any buffered spans. Must never throw.
  Future<void> flush();
}

/// No-op telemetry: used in tests and whenever OTEL_ENDPOINT is unset.
class NoopTelemetryService implements TelemetryService {
  const NoopTelemetryService();

  @override
  bool get isEnabled => false;

  @override
  Future<void> recordSpan(TelemetrySpan span) async {}

  @override
  Future<T> trace<T>(
    String name,
    Future<T> Function() operation, {
    String? requestId,
    Map<String, String> attributes = const {},
  }) {
    // Pass the operation straight through; no timing, no export.
    return operation();
  }

  @override
  Future<void> flush() async {}
}

/// Standard OHPP telemetry attribute keys (kept identical to the backends so a
/// ceremony correlates across services in Grafana).
class OhppTelemetryKeys {
  static const String serviceName = 'service.name';
  static const String requestId = 'ohpp.request_id';
  static const String clientServiceName = 'ohpp.client';
}
