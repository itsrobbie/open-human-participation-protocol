import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/observability/analytics_sink.dart';

/// Injects the app's [AnalyticsSink].
///
/// Defaults to a no-op so tests and unconfigured runs capture nothing. main.dart
/// overrides this with a PostHogAnalyticsSink when ANALYTICS_HOST + ANALYTICS_KEY
/// are set.
final analyticsSinkProvider = Provider<AnalyticsSink>((ref) {
  return const NoopAnalyticsSink();
});
