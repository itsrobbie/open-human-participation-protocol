import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Telemetry consent state.
class TelemetryNotifier extends StateNotifier<bool> {
  TelemetryNotifier() : super(false); // Default: not consented until onboarding

  void optIn() => state = true;
  void optOut() => state = false;
}

final telemetryConsentProvider =
    StateNotifierProvider<TelemetryNotifier, bool>((ref) {
  return TelemetryNotifier();
});
