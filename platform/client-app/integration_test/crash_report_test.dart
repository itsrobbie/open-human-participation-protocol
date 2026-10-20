import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:ohpp_client/core/observability/sentry_crash_reporter.dart';

/// U7.1 Phase 5 live verification: the app's crash path reaches GlitchTip.
///
/// When CRASH_DSN is set (the Makefile flutter-test-e2e target defaults it to
/// the seeded GlitchTip dev project), this initializes Sentry exactly as
/// main.dart does, then records a uniquely-tagged error through the real
/// SentryCrashReporter. A follow-up GlitchTip API query (run after this test)
/// confirms the event was ingested.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const crashDsn = String.fromEnvironment('CRASH_DSN', defaultValue: '');

  testWidgets('app crash reporter delivers an error to GlitchTip',
      (tester) async {
    if (crashDsn.isEmpty) {
      // ignore: avoid_print
      print('[crash_report_test] CRASH_DSN unset; skipping live crash report.');
      return;
    }

    final marker = 'e2e-crash-${DateTime.now().millisecondsSinceEpoch}';

    await SentryFlutter.init((options) {
      options.dsn = crashDsn;
      options.tracesSampleRate = 0.0;
      options.attachStacktrace = true;
      options.sendDefaultPii = false;
    });

    const reporter = SentryCrashReporter();
    expect(reporter.isEnabled, isTrue);

    await reporter.recordError(
      Exception('OHPP e2e crash verification: $marker'),
      StackTrace.current,
      context: {'ohpp.request_id': marker, 'screen': 'e2e'},
    );

    // Give the SDK a moment to flush to GlitchTip, then close.
    await Sentry.close();

    // ignore: avoid_print
    print('[crash_report_test] recorded crash marker=$marker');
  });
}
