import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'telemetry_service.dart';

/// Signature for the HTTP POST used to export spans. Injected so tests can
/// supply a recording or failing fake without real network calls.
///
/// Returns the HTTP status code; implementations should not throw for non-2xx.
typedef OtlpPoster = Future<int> Function(
  Uri url,
  Map<String, String> headers,
  String body,
);

/// Exports spans to an OpenTelemetry Collector over OTLP/HTTP (JSON encoding).
///
/// Self-contained on purpose: the OpenTelemetry Dart SDK is immature, so rather
/// than depend on it we emit the small, stable OTLP/JSON trace payload directly.
/// This mirrors the resolver/Node approach of "standard OTLP, our own thin glue".
///
/// Fail-open (NFR-A1): every export path swallows errors; a telemetry failure
/// never surfaces to the user. Enabled only when constructed with a non-empty
/// endpoint (main.dart passes OTEL_ENDPOINT).
class OtlpTelemetryService implements TelemetryService {
  /// Base collector endpoint, e.g. http://192.168.68.60:4318. Spans are POSTed
  /// to "$endpoint/v1/traces".
  final String endpoint;
  final String serviceName;
  final OtlpPoster _post;
  final Random _random;

  /// Fixed trace/span id space per app run is not needed; ids are per-span.
  OtlpTelemetryService({
    required this.endpoint,
    this.serviceName = OhppTelemetryKeys.clientServiceName,
    required OtlpPoster poster,
    Random? random,
  })  : _post = poster,
        _random = random ?? Random.secure();

  @override
  bool get isEnabled => endpoint.trim().isNotEmpty;

  @override
  Future<void> recordSpan(TelemetrySpan span) async {
    if (!isEnabled) return;
    try {
      final payload = _encodeTracePayload(span);
      final url = Uri.parse('${endpoint.replaceAll(RegExp(r"/$"), "")}/v1/traces');
      await _post(
        url,
        const {'Content-Type': 'application/json'},
        jsonEncode(payload),
      );
    } catch (e) {
      // Fail-open: telemetry must never break the app.
      debugPrint('[OtlpTelemetryService] span export failed (ignored): $e');
    }
  }

  @override
  Future<T> trace<T>(
    String name,
    Future<T> Function() operation, {
    String? requestId,
    Map<String, String> attributes = const {},
  }) async {
    final start = DateTime.now().toUtc();
    try {
      final result = await operation();
      await recordSpan(TelemetrySpan(
        name: name,
        startTime: start,
        endTime: DateTime.now().toUtc(),
        attributes: _withRequestId(attributes, requestId),
      ));
      return result;
    } catch (_) {
      await recordSpan(TelemetrySpan(
        name: name,
        startTime: start,
        endTime: DateTime.now().toUtc(),
        isError: true,
        attributes: _withRequestId(attributes, requestId),
      ));
      rethrow;
    }
  }

  @override
  Future<void> flush() async {
    // Spans are exported synchronously on record; nothing buffered to flush.
  }

  Map<String, String> _withRequestId(Map<String, String> attributes, String? requestId) {
    if (requestId == null || requestId.trim().isEmpty) return attributes;
    return {...attributes, OhppTelemetryKeys.requestId: requestId};
  }

  /// Build the OTLP/JSON ExportTraceServiceRequest for a single span.
  Map<String, dynamic> _encodeTracePayload(TelemetrySpan span) {
    final traceId = _hexId(16);
    final spanId = _hexId(8);
    final startNanos = _toUnixNanos(span.startTime);
    final endNanos = _toUnixNanos(span.endTime);

    final spanAttributes = <Map<String, dynamic>>[
      for (final entry in span.attributes.entries)
        {
          'key': entry.key,
          'value': {'stringValue': entry.value},
        },
    ];

    return {
      'resourceSpans': [
        {
          'resource': {
            'attributes': [
              {
                'key': OhppTelemetryKeys.serviceName,
                'value': {'stringValue': serviceName},
              },
            ],
          },
          'scopeSpans': [
            {
              'scope': {'name': 'ohpp.client'},
              'spans': [
                {
                  'traceId': traceId,
                  'spanId': spanId,
                  'name': span.name,
                  'kind': 1, // SPAN_KIND_INTERNAL
                  'startTimeUnixNano': startNanos.toString(),
                  'endTimeUnixNano': endNanos.toString(),
                  'attributes': spanAttributes,
                  'status': {
                    'code': span.isError ? 2 : 1, // ERROR : OK
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  String _hexId(int bytes) {
    final sb = StringBuffer();
    for (var i = 0; i < bytes; i++) {
      sb.write(_random.nextInt(256).toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }

  int _toUnixNanos(DateTime dt) => dt.toUtc().microsecondsSinceEpoch * 1000;
}
