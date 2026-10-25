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
}

final appsProvider =
    StateNotifierProvider<AppsNotifier, AppsState>((ref) {
  throw UnimplementedError('Must be overridden with data source');
});
