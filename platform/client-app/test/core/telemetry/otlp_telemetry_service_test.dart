import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/telemetry/telemetry_service.dart';
import 'package:ohpp_client/core/telemetry/otlp_telemetry_service.dart';

/// Recording fake for the OTLP HTTP poster (mirrors the app's hand-written-fake
/// convention rather than mockito codegen).
class _RecordingPoster {
  final List<({Uri url, String body})> calls = [];
  int statusToReturn = 200;
  bool throwOnPost;

  _RecordingPoster({this.throwOnPost = false});

  Future<int> post(Uri url, Map<String, String> headers, String body) async {
    calls.add((url: url, body: body));
    if (throwOnPost) throw Exception('network down');
    return statusToReturn;
  }
}

void main() {
  group('NoopTelemetryService', () {
    test('telemetry_disabledWhenEndpointUnset', () async {
      const svc = NoopTelemetryService();

      expect(svc.isEnabled, isFalse);
      // Recording a span and tracing must be safe no-ops.
      await svc.recordSpan(TelemetrySpan(
        name: 'x',
        startTime: DateTime.now(),
        endTime: DateTime.now(),
      ));
      final result = await svc.trace('op', () async => 42);
      expect(result, 42);
    });

    test('OtlpTelemetryService is disabled when endpoint is blank', () {
      final poster = _RecordingPoster();
      final svc = OtlpTelemetryService(endpoint: '   ', poster: poster.post);
      expect(svc.isEnabled, isFalse);
    });
  });

  group('OtlpTelemetryService export', () {
    test('telemetry_exportFailure_swallowed', () async {
      final poster = _RecordingPoster(throwOnPost: true);
      final svc = OtlpTelemetryService(
        endpoint: 'http://collector:4318',
        poster: poster.post,
      );

      // Must not throw even though the poster throws (fail-open).
      await svc.recordSpan(TelemetrySpan(
        name: 'api.call',
        startTime: DateTime.now().toUtc(),
        endTime: DateTime.now().toUtc(),
      ));

      // trace() still returns the operation result and rethrows operation errors,
      // but the export failure itself is swallowed.
      final value = await svc.trace('op', () async => 'ok');
      expect(value, 'ok');
    });

    test('telemetry_stampsRequestIdAttribute', () async {
      final poster = _RecordingPoster();
      final svc = OtlpTelemetryService(
        endpoint: 'http://collector:4318',
        poster: poster.post,
      );

      await svc.trace(
        'api.submitAttestation',
        () async => null,
        requestId: 'req-123',
      );

      expect(poster.calls, hasLength(1));
      expect(poster.calls.single.url.toString(), 'http://collector:4318/v1/traces');

      final decoded = jsonDecode(poster.calls.single.body) as Map<String, dynamic>;
      final span = decoded['resourceSpans'][0]['scopeSpans'][0]['spans'][0]
          as Map<String, dynamic>;
      final attrs = (span['attributes'] as List)
          .cast<Map<String, dynamic>>()
          .map((a) => MapEntry(a['key'] as String, a['value']['stringValue'] as String))
          .fold<Map<String, String>>({}, (m, e) => m..[e.key] = e.value);

      expect(attrs[OhppTelemetryKeys.requestId], 'req-123');
      expect(span['name'], 'api.submitAttestation');
    });

    test('service.name resource attribute is ohpp.client', () async {
      final poster = _RecordingPoster();
      final svc = OtlpTelemetryService(
        endpoint: 'http://collector:4318',
        poster: poster.post,
      );

      await svc.recordSpan(TelemetrySpan(
        name: 'screen.pending',
        startTime: DateTime.now().toUtc(),
        endTime: DateTime.now().toUtc(),
      ));

      final decoded = jsonDecode(poster.calls.single.body) as Map<String, dynamic>;
      final resourceAttrs = (decoded['resourceSpans'][0]['resource']['attributes'] as List)
          .cast<Map<String, dynamic>>();
      final serviceNameAttr = resourceAttrs
          .firstWhere((a) => a['key'] == OhppTelemetryKeys.serviceName);
      expect(serviceNameAttr['value']['stringValue'], OhppTelemetryKeys.clientServiceName);
    });

    test('error operation records an error span and rethrows', () async {
      final poster = _RecordingPoster();
      final svc = OtlpTelemetryService(
        endpoint: 'http://collector:4318',
        poster: poster.post,
      );

      await expectLater(
        svc.trace('op', () async => throw StateError('boom')),
        throwsA(isA<StateError>()),
      );

      final decoded = jsonDecode(poster.calls.single.body) as Map<String, dynamic>;
      final span = decoded['resourceSpans'][0]['scopeSpans'][0]['spans'][0]
          as Map<String, dynamic>;
      expect(span['status']['code'], 2); // ERROR
    });
  });
}
