/// Entity types that can be cached and synced.
enum SyncEntityType {
  rules,
  apps,
  notificationPrefs,
  pending,
  history,
}

/// Interface for cache storage operations (implemented by DB layer).
abstract class CacheStore {
  Future<List<Map<String, dynamic>>> getCached(SyncEntityType type);
  Future<void> updateCache(SyncEntityType type, List<Map<String, dynamic>> data);
  Future<void> clearCache(SyncEntityType type);
}

/// Manages local cache with stale-while-revalidate pattern.
/// Shows cached data immediately, refreshes in background, updates on completion.
class CacheManager {
  final CacheStore _store;
  final Map<SyncEntityType, DateTime> _lastSyncTimes = {};

  /// TTL per entity type (how long before cache is considered stale).
  static const Map<SyncEntityType, Duration> ttls = {
    SyncEntityType.rules: Duration(minutes: 5),
    SyncEntityType.apps: Duration(minutes: 5),
    SyncEntityType.notificationPrefs: Duration(minutes: 10),
    SyncEntityType.pending: Duration(seconds: 30),
    SyncEntityType.history: Duration(minutes: 2),
  };

  CacheManager({required CacheStore store}) : _store = store;

  /// Get cached data (returns immediately, may be stale).
  Future<List<Map<String, dynamic>>> getCached(SyncEntityType type) {
    return _store.getCached(type);
  }

  /// Refresh cache from server data.
  Future<void> refresh(SyncEntityType type, List<Map<String, dynamic>> freshData) async {
    await _store.updateCache(type, freshData);
    _lastSyncTimes[type] = DateTime.now().toUtc();
  }

  /// Mark a cache type as stale (next read triggers refresh).
  void invalidate(SyncEntityType type) {
    _lastSyncTimes.remove(type);
  }

  /// Check if entity type is stale (exceeded TTL since last sync).
  bool isStale(SyncEntityType type) {
    final lastSync = _lastSyncTimes[type];
    if (lastSync == null) return true;

    final ttl = ttls[type] ?? const Duration(minutes: 5);
    return DateTime.now().toUtc().difference(lastSync) > ttl;
  }

  /// Get last sync time for an entity type.
  DateTime? getLastSyncTime(SyncEntityType type) => _lastSyncTimes[type];
}
