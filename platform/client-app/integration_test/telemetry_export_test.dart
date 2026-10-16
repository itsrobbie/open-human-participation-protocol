import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ohpp_client/core/telemetry/otlp_telemetry_service.dart';
import 'package:ohpp_client/core/telemetry/telemetry_service.dart';

/// U7.1 Phase 5 live verification: the app's real OTLP exporter reaches the
/// OpenTelemetry Collector. Runs on the simulator against `make dev` and posts
/// a real span through the same OtlpTelemetryService the app uses in main.dart.
///
/// The span carries a unique marker request id; a follow-up Tempo query (run by
/// the Makefile/agent after this test) confirms it arrived as service.name=
/// ohpp.client. Kept as an integration test so it's reviewable and repeatable.
///
/// OTEL endpoint is provided via --dart-define=OTEL_ENDPOINT (the Makefile
/// flutter-test-e2e target defaults it to http://localhost:4318).
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const otelEndpoint = String.fromEnvironment('OTEL_ENDPOINT', defaultValue: '');

  testWidgets('app OTLP exporter delivers a span to the Collector (2xx)',
      (tester) async {
    // Skip cleanly when telemetry isn't configured (e.g. plain unit runs).
    if (otelEndpoint.isEmpty) {
      // ignore: avoid_print
      print('[telemetry_export_test] OTEL_ENDPOINT unset; skipping live export.');
      return;
    }

    var lastStatus = 0;
    final service = OtlpTelemetryService(
      endpoint: otelEndpoint,
      poster: (url, headers, body) async {
        final dio = Dio();
        final res = await dio.postUri<dynamic>(
          url,
          data: body,
          options: Options(headers: headers, validateStatus: (_) => true),
        );
        lastStatus = res.statusCode ?? 0;
        return lastStatus;
      },
    );

    expect(service.isEnabled, isTrue);

    // Unique marker so the span is findable in Tempo after the run.
    final marker = 'e2e-telemetry-${DateTime.now().millisecondsSinceEpoch}';
    await service.trace(
      'e2e.telemetry.verification',
      () async => null,
      requestId: marker,
    );

    // The Collector accepted the OTLP/HTTP export.
    expect(lastStatus, inInclusiveRange(200, 299),
        reason: 'Collector should accept the span export; got $lastStatus');

    // ignore: avoid_print
    print('[telemetry_export_test] exported span requestId=$marker status=$lastStatus');
  });
}
