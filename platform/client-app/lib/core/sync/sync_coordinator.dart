import 'package:ohpp_client/core/database/cache_manager.dart';

/// Exception indicating no network connectivity.
class OfflineException implements Exception {
  const OfflineException();
}

/// Exception indicating auth tokens have expired and refresh failed.
class AuthExpiredException implements Exception {
  const AuthExpiredException();
}

/// Interface for fetching data from the Resolver API per entity type.
abstract class SyncApiSource {
  Future<List<Map<String, dynamic>>> fetch(SyncEntityType type);
}

/// Coordinates background data sync from Resolver to local cache.
/// Full sync on login/launch, incremental sync on resume (TTL-based).
class SyncCoordinator {
  final SyncApiSource _apiSource;
  final CacheManager _cacheManager;
  final void Function() onAuthExpired;

  SyncCoordinator({
    required SyncApiSource apiSource,
    required CacheManager cacheManager,
    required this.onAuthExpired,
  })  : _apiSource = apiSource,
        _cacheManager = cacheManager;

  /// Full sync: fetch all entity types regardless of staleness.
  Future<void> syncAll() async {
    for (final type in SyncEntityType.values) {
      await _syncType(type, force: true);
    }
  }

  /// Sync a single entity type. Skips if cache is still fresh (within TTL).
  Future<void> syncEntity(SyncEntityType type) async {
    if (!_cacheManager.isStale(type)) return;
    await _syncType(type, force: false);
  }

  /// Get last sync time for an entity type.
  DateTime? getLastSyncTime(SyncEntityType type) {
    return _cacheManager.getLastSyncTime(type);
  }

  Future<void> _syncType(SyncEntityType type, {required bool force}) async {
    try {
      final data = await _apiSource.fetch(type);
      await _cacheManager.refresh(type, data);
    } on OfflineException {
      // Offline: skip silently, keep cached data
      return;
    } on AuthExpiredException {
      onAuthExpired();
      return;
    } catch (_) {
      // Server error: log and continue, keep stale cache
      return;
    }
  }
}
