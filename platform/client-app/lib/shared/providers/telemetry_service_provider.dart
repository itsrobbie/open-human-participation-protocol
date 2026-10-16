import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/telemetry/telemetry_service.dart';

/// Injects the app's [TelemetryService].
///
/// Defaults to a no-op so tests and unconfigured runs export nothing. main.dart
/// overrides this with an [OtlpTelemetryService] when OTEL_ENDPOINT is set.
final telemetryServiceProvider = Provider<TelemetryService>((ref) {
  return const NoopTelemetryService();
});
