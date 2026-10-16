import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/observability/crash_reporter.dart';

/// Injects the app's [CrashReporter].
///
/// Defaults to a no-op so tests and unconfigured runs report nothing. main.dart
/// overrides this with a SentryCrashReporter when CRASH_DSN is set.
final crashReporterProvider = Provider<CrashReporter>((ref) {
  return const NoopCrashReporter();
});
