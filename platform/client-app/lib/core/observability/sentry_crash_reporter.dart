import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'crash_reporter.dart';

/// Crash reporter backed by the Sentry SDK, pointed at self-hosted GlitchTip
/// (which is Sentry-API-compatible). The DSN is supplied at build time via
/// --dart-define=CRASH_DSN; when unset the app uses [NoopCrashReporter] instead,
/// so this class is only constructed with a real DSN.
///
/// Fail-open (NFR-A1): every method swallows errors so a crash-reporting failure
/// never becomes a second crash.
///
/// Sentry.init() itself is performed once in main.dart (it wraps runApp); this
/// class assumes Sentry is already initialized and just forwards events.
class SentryCrashReporter implements CrashReporter {
  const SentryCrashReporter();

  @override
  bool get isEnabled => true;

  @override
  Future<void> recordError(
    Object error,
    StackTrace? stackTrace, {
    Map<String, String> context = const {},
    bool fatal = false,
  }) async {
    try {
      final scrubbed = CrashContextScrubber.scrub(context);
      await Sentry.captureException(
        error,
        stackTrace: stackTrace,
        withScope: (scope) {
          scope.level = fatal ? SentryLevel.fatal : SentryLevel.error;
          for (final entry in scrubbed.entries) {
            scope.setTag(entry.key, entry.value);
          }
        },
      );
    } catch (e) {
      // Fail-open: never let crash reporting itself throw.
      debugPrint('[SentryCrashReporter] captureException failed (ignored): $e');
    }
  }
}
