import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/telemetry/otlp_telemetry_service.dart';
import 'package:ohpp_client/core/telemetry/telemetry_service.dart';

/// Live telemetry verification (U7.1 Phase 10 follow-up).
///
/// Proves the app's REAL trace-export path works end to end: it builds the same
/// [OtlpTelemetryService] the app uses in main.dart, with a real HTTP poster, and
/// exports a uniquely-named span to the live OTel Collector's OTLP/HTTP endpoint.
/// It asserts the collector accepted the export (2xx). The `make verify-flutter-
/// telemetry` target then queries Tempo to confirm the span is searchable as
/// `ohpp.client` - so the two halves together prove "Flutter data shows up in the
/// dashboard".
///
/// NOT part of the hermetic `flutter test` (test/) suite - it needs the dev stack
/// up. Run via `make verify-flutter-telemetry`.
///
/// Config (via --dart-define):
///   OTEL_ENDPOINT   collector OTLP/HTTP base, e.g. http://localhost:4318
///   SPAN_NAME       the unique span name to emit (the make target passes + greps it)
void main() {
  const endpoint = String.fromEnvironment('OTEL_ENDPOINT', defaultValue: 'http://localhost:4318');
  const spanName = String.fromEnvironment('SPAN_NAME', defaultValue: 'verify_flutter_probe');

  test('flutter_telemetry_exportsSpanToCollector', () async {
    // Capture the HTTP status the collector returns, using the exact OTLP/JSON
    // payload OtlpTelemetryService builds (the poster mirrors main.dart).
    var lastStatus = -1;

    final service = OtlpTelemetryService(
      endpoint: endpoint,
      serviceName: OhppTelemetryKeys.clientServiceName, // ohpp.client
      poster: (url, headers, body) async {
        final client = HttpClient();
        try {
          final req = await client.postUrl(url);
          headers.forEach(req.headers.set);
          req.write(body);
          final resp = await req.close();
          await resp.drain<void>();
          lastStatus = resp.statusCode;
          return resp.statusCode;
        } finally {
          client.close(force: true);
        }
      },
    );

    expect(service.isEnabled, isTrue, reason: 'OTEL_ENDPOINT must be set for the live check');

    final now = DateTime.now().toUtc();
    await service.recordSpan(TelemetrySpan(
      name: spanName,
      startTime: now,
      endTime: now.add(const Duration(milliseconds: 5)),
      attributes: const {'ohpp.request_id': 'verify-flutter-telemetry'},
    ));

    expect(
      lastStatus >= 200 && lastStatus < 300,
      isTrue,
      reason: 'the collector should accept the OTLP export (got HTTP $lastStatus)',
    );
  });
}
