import 'package:flutter_riverpod/flutter_riverpod.dart';

/// State for registered apps list.
class AppsState {
  final List<Map<String, dynamic>> apps;
  final bool isLoading;
  final String? error;

  const AppsState({
    this.apps = const [],
    this.isLoading = false,
    this.error,
  });

  AppsState copyWith({
    List<Map<String, dynamic>>? apps,
    bool? isLoading,
    String? error,
  }) {
    return AppsState(
      apps: apps ?? this.apps,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Interface for apps data operations.
abstract class AppsDataSource {
  Future<List<Map<String, dynamic>>> fetchApps();
  Future<void> revokeApp(String appId);
  Future<void> setNotificationPreference(String appId, bool enabled);

  /// Process a registration challenge (base64url payload) to connect an app.
  /// Returns the resolver's response (the new registration).
  Future<Map<String, dynamic>> processChallenge(String base64Payload);
}

/// Manages registered apps with optimistic updates.
class AppsNotifier extends StateNotifier<AppsState> {
  final AppsDataSource _dataSource;

  AppsNotifier({required AppsDataSource dataSource})
      : _dataSource = dataSource,
        super(const AppsState());

  Future<void> fetchApps() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final apps = await _dataSource.fetchApps();
      if (!mounted) return;
      state = state.copyWith(apps: apps, isLoading: false);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> revokeApp(String registrationId) async {
    // Optimistic remove. registrationId is the registration GUID (what the
    // resolver's DELETE expects); match it against either the registration id
    // or the app's string id so the card disappears immediately regardless.
    final backup = List<Map<String, dynamic>>.from(state.apps);
    state = state.copyWith(
      apps: state.apps
          .where((a) => a['id'] != registrationId && a['appId'] != registrationId)
          .toList(),
    );
    try {
      await _dataSource.revokeApp(registrationId);
      return true;
    } catch (e) {
      // Rollback
      state = state.copyWith(apps: backup);
      return false;
    }
  }

  /// Connect an app by processing a registration challenge (base64url payload),
  /// then refresh the list so the new app appears. Returns true on success.
  Future<bool> connectViaChallenge(String base64Payload) async {
    try {
      await _dataSource.processChallenge(base64Payload);
      await fetchApps();
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  /// Persist the push-notification preference for [appId] (the app's string id).
  /// Optimistically updates the in-memory app so the toggle sticks across a
  /// sheet re-open; rolls back on failure.
  Future<bool> setNotificationPreference(String appId, bool enabled) async {
    final backup = List<Map<String, dynamic>>.from(state.apps);
    state = state.copyWith(
      apps: state.apps
          .map((a) => a['appId'] == appId ? {...a, 'pushEnabled': enabled} : a)
          .toList(),
    );
    try {
      await _dataSource.setNotificationPreference(appId, enabled);
      return true;
    } catch (e) {
      state = state.copyWith(apps: backup);
      return false;
    }
  }
}

final appsProvider =
    StateNotifierProvider<AppsNotifier, AppsState>((ref) {
  throw UnimplementedError('Must be overridden with data source');
});
