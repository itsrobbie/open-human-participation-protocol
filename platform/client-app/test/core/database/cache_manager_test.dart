import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/database/cache_manager.dart';

void main() {
  late CacheManager cacheManager;
  late _FakeCacheStore store;

  setUp(() {
    store = _FakeCacheStore();
    cacheManager = CacheManager(store: store);
  });

  group('getCached', () {
    test('getCached_DataExists_ReturnsImmediately', () async {
      store.data[SyncEntityType.rules] = [
        {'id': 'r1', 'name': 'Rule 1'},
      ];

      final result = await cacheManager.getCached(SyncEntityType.rules);

      expect(result.length, equals(1));
      expect(result.first['name'], equals('Rule 1'));
    });

    test('getCached_EmptyDB_ReturnsEmptyList', () async {
      final result = await cacheManager.getCached(SyncEntityType.rules);

      expect(result, isEmpty);
    });

    test('getCached_AfterInvalidate_StillReturnsCached', () async {
      store.data[SyncEntityType.apps] = [
        {'id': 'a1'},
      ];
      cacheManager.invalidate(SyncEntityType.apps);

      final result = await cacheManager.getCached(SyncEntityType.apps);

      // Invalidation marks stale but doesn't delete data
      expect(result.length, equals(1));
    });
  });

  group('refresh', () {
    test('refresh_FetchesAndUpdatesDB', () async {
      final freshData = [
        {'id': 'r1', 'name': 'Fresh Rule'},
      ];

      await cacheManager.refresh(SyncEntityType.rules, freshData);

      final cached = await cacheManager.getCached(SyncEntityType.rules);
      expect(cached.first['name'], equals('Fresh Rule'));
    });

    test('refresh_NotifiesProviders', () async {
      // After refresh, lastSyncTime is updated (providers can check this)
      await cacheManager.refresh(SyncEntityType.rules, []);

      expect(cacheManager.getLastSyncTime(SyncEntityType.rules), isNotNull);
    });

    test('refresh_ServerReturnsEmpty_ClearsLocalCache', () async {
      store.data[SyncEntityType.rules] = [
        {'id': 'old'},
      ];

      await cacheManager.refresh(SyncEntityType.rules, []);

      final cached = await cacheManager.getCached(SyncEntityType.rules);
      expect(cached, isEmpty);
    });
  });

  group('invalidate', () {
    test('invalidate_MarksCacheStale', () async {
      await cacheManager.refresh(SyncEntityType.rules, []);
      expect(cacheManager.isStale(SyncEntityType.rules), isFalse);

      cacheManager.invalidate(SyncEntityType.rules);

      expect(cacheManager.isStale(SyncEntityType.rules), isTrue);
    });
  });

  group('isStale', () {
    test('isStale_NeverSynced_ReturnsTrue', () {
      expect(cacheManager.isStale(SyncEntityType.pending), isTrue);
    });

    test('isStale_JustSynced_ReturnsFalse', () async {
      await cacheManager.refresh(SyncEntityType.rules, []);

      expect(cacheManager.isStale(SyncEntityType.rules), isFalse);
    });
  });
}

class _FakeCacheStore implements CacheStore {
  final Map<SyncEntityType, List<Map<String, dynamic>>> data = {};

  @override
  Future<List<Map<String, dynamic>>> getCached(SyncEntityType type) async {
    return data[type] ?? [];
  }

  @override
  Future<void> updateCache(SyncEntityType type, List<Map<String, dynamic>> newData) async {
    data[type] = newData;
  }

  @override
  Future<void> clearCache(SyncEntityType type) async {
    data.remove(type);
  }
}
