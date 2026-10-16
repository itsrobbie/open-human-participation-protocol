import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/sync/sync_coordinator.dart';
import 'package:ohpp_client/core/database/cache_manager.dart';

void main() {
  late SyncCoordinator coordinator;
  late _FakeApiSource apiSource;
  late _FakeCacheStore cacheStore;
  late CacheManager cacheManager;
  late bool logoutCalled;

  setUp(() {
    apiSource = _FakeApiSource();
    cacheStore = _FakeCacheStore();
    cacheManager = CacheManager(store: cacheStore);
    logoutCalled = false;
    coordinator = SyncCoordinator(
      apiSource: apiSource,
      cacheManager: cacheManager,
      onAuthExpired: () => logoutCalled = true,
    );
  });

  // --- Happy path ---

  group('syncAll', () {
    test('syncAll_FetchesAllEntityTypes', () async {
      await coordinator.syncAll();

      expect(apiSource.fetchedTypes, containsAll(SyncEntityType.values));
    });

    test('syncAll_UpdatesLocalCache', () async {
      apiSource.responses[SyncEntityType.rules] = [
        {'id': 'r1', 'name': 'Rule 1'},
      ];

      await coordinator.syncAll();

      final cached = await cacheManager.getCached(SyncEntityType.rules);
      expect(cached.length, equals(1));
      expect(cached.first['name'], equals('Rule 1'));
    });

    test('syncAll_UpdatesLastSyncTimestamps', () async {
      await coordinator.syncAll();

      for (final type in SyncEntityType.values) {
        expect(cacheManager.getLastSyncTime(type), isNotNull);
      }
    });
  });

  group('syncEntity', () {
    test('syncEntity_StaleEntity_Fetches', () async {
      // All entities are stale by default (never synced)
      await coordinator.syncEntity(SyncEntityType.rules);

      expect(apiSource.fetchedTypes, contains(SyncEntityType.rules));
    });

    test('syncEntity_FreshEntity_Skips', () async {
      // First sync to make it fresh
      await coordinator.syncEntity(SyncEntityType.rules);
      apiSource.fetchedTypes.clear();

      // Second sync should skip (within TTL)
      await coordinator.syncEntity(SyncEntityType.rules);

      expect(apiSource.fetchedTypes, isEmpty);
    });

    test('getLastSyncTime_ReturnsCorrectTimestamp', () async {
      final before = DateTime.now().toUtc();
      await coordinator.syncEntity(SyncEntityType.apps);
      final after = DateTime.now().toUtc();

      final syncTime = coordinator.getLastSyncTime(SyncEntityType.apps);
      expect(syncTime, isNotNull);
      expect(syncTime!.isAfter(before.subtract(const Duration(seconds: 1))), isTrue);
      expect(syncTime.isBefore(after.add(const Duration(seconds: 1))), isTrue);
    });
  });

  // --- Non-happy path ---

  group('syncAll - failures', () {
    test('syncAll_PartialFailure_ContinuesOtherEntities', () async {
      apiSource.failFor.add(SyncEntityType.rules);

      await coordinator.syncAll();

      // Rules failed but others should have been fetched
      expect(apiSource.fetchedTypes, contains(SyncEntityType.apps));
      expect(apiSource.fetchedTypes, contains(SyncEntityType.pending));
    });

    test('syncAll_Offline_SkipsAllNoError', () async {
      apiSource.isOffline = true;

      // Should not throw
      await coordinator.syncAll();

      expect(apiSource.fetchedTypes, isEmpty);
    });

    test('syncEntity_ServerError_LogsAndContinues', () async {
      apiSource.failFor.add(SyncEntityType.history);

      // Should not throw
      await coordinator.syncEntity(SyncEntityType.history);

      // Cache should not be updated (stale data preserved)
      expect(cacheManager.isStale(SyncEntityType.history), isTrue);
    });

    test('syncEntity_AuthExpired_TriggersLogout', () async {
      apiSource.authExpiredFor.add(SyncEntityType.rules);

      await coordinator.syncEntity(SyncEntityType.rules);

      expect(logoutCalled, isTrue);
    });
  });
}

/// Fake API data source for testing sync operations.
class _FakeApiSource implements SyncApiSource {
  final Map<SyncEntityType, List<Map<String, dynamic>>> responses = {};
  final List<SyncEntityType> fetchedTypes = [];
  final Set<SyncEntityType> failFor = {};
  final Set<SyncEntityType> authExpiredFor = {};
  bool isOffline = false;

  @override
  Future<List<Map<String, dynamic>>> fetch(SyncEntityType type) async {
    if (isOffline) throw const OfflineException();
    if (authExpiredFor.contains(type)) throw const AuthExpiredException();
    if (failFor.contains(type)) throw Exception('Server error');

    fetchedTypes.add(type);
    return responses[type] ?? [];
  }
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
