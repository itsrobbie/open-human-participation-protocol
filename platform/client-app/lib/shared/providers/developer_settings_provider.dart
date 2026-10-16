import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:ohpp_client/core/observability/dev_logger.dart';

/// Developer settings (currently just the diagnostic-logging toggle).
@immutable
class DeveloperSettings {
  final bool loggingEnabled;

  const DeveloperSettings({this.loggingEnabled = false});

  DeveloperSettings copyWith({bool? loggingEnabled}) => DeveloperSettings(
        loggingEnabled: loggingEnabled ?? this.loggingEnabled,
      );
}

/// Persists the developer-logging flag in secure storage (the app's only
/// key/value store) and keeps [DevLog.instance] in sync so logging turns on/off
/// immediately across the non-Riverpod call sites (Dio interceptor, SSE, etc.).
class DeveloperSettingsNotifier extends StateNotifier<DeveloperSettings> {
  final FlutterSecureStorage _storage;
  final DevLog _devLog;

  static const _keyLoggingEnabled = 'ohpp_dev_logging_enabled';

  DeveloperSettingsNotifier({
    required FlutterSecureStorage storage,
    DevLog? devLog,
  })  : _storage = storage,
        _devLog = devLog ?? DevLog.instance,
        super(const DeveloperSettings()) {
    _load();
  }

  Future<void> _load() async {
    final raw = await _storage.read(key: _keyLoggingEnabled);
    final enabled = raw == 'true';
    _devLog.enabled = enabled;
    if (mounted) state = state.copyWith(loggingEnabled: enabled);
  }

  Future<void> setLoggingEnabled(bool enabled) async {
    _devLog.enabled = enabled;
    state = state.copyWith(loggingEnabled: enabled);
    await _storage.write(key: _keyLoggingEnabled, value: enabled.toString());
  }
}

/// Overridden in main.dart with a storage-backed notifier. The default here is
/// in-memory (no persistence) so widget tests and previews work without storage.
final developerSettingsProvider =
    StateNotifierProvider<DeveloperSettingsNotifier, DeveloperSettings>((ref) {
  return DeveloperSettingsNotifier(storage: const FlutterSecureStorage());
});
