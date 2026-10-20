import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

void main() {
  // --- Pending provider ---

  group('pendingProvider', () {
    test('pendingProvider_Init_ReturnsCachedThenRefreshes', () async {
      final dataSource = _FakePendingDataSource(
        cached: [{'requestId': 'cached-1'}],
        remote: [{'requestId': 'fresh-1'}, {'requestId': 'fresh-2'}],
      );
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      // Initially shows cached
      final initial = container.read(pendingProvider);
      expect(initial.requests.length, equals(1));
      expect(initial.requests.first['requestId'], equals('cached-1'));

      // Wait for refresh
      await Future.delayed(const Duration(milliseconds: 10));
      final refreshed = container.read(pendingProvider);
      expect(refreshed.requests.length, equals(2));
    });

    test('pendingProvider_SseEvent_AddsToList', () async {
      final dataSource = _FakePendingDataSource(cached: [], remote: []);
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);
      await Future.delayed(const Duration(milliseconds: 10));

      container.read(pendingProvider.notifier).addFromSse({'requestId': 'sse-1', 'appId': 'pizza.test'});

      final state = container.read(pendingProvider);
      expect(state.requests.length, equals(1));
      expect(state.requests.first['requestId'], equals('sse-1'));
    });

    test('pendingProvider_PullRefresh_FetchesFresh', () async {
      final dataSource = _FakePendingDataSource(
        cached: [{'requestId': 'old'}],
        remote: [{'requestId': 'new'}],
      );
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);
      await Future.delayed(const Duration(milliseconds: 10));

      dataSource.remote = [{'requestId': 'refreshed'}];
      await container.read(pendingProvider.notifier).refresh();

      expect(container.read(pendingProvider).requests.first['requestId'], equals('refreshed'));
    });

    test('pendingProvider_Offline_ReturnsCachedOnly', () async {
      final dataSource = _FakePendingDataSource(
        cached: [{'requestId': 'cached'}],
        shouldFail: true,
      );
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      // Explicitly refresh (simulating pull-to-refresh while offline)
      await container.read(pendingProvider.notifier).refresh();

      final state = container.read(pendingProvider);
      // Still shows cached even after failed refresh
      expect(state.requests.first['requestId'], equals('cached'));
      expect(state.error, isNotNull);
    });

    test('queueProvider_Enqueue_IncrementsBadge', () async {
      final dataSource = _FakePendingDataSource(cached: [], remote: []);
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      container.read(pendingProvider.notifier).updateQueueCount(3);

      expect(container.read(pendingProvider).offlineQueueCount, equals(3));
    });

    test('queueProvider_Drain_DecrementsBadge', () async {
      final dataSource = _FakePendingDataSource(cached: [], remote: []);
      final container = ProviderContainer(overrides: [
        pendingProvider.overrideWith((ref) => PendingNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      container.read(pendingProvider.notifier).updateQueueCount(5);
      container.read(pendingProvider.notifier).updateQueueCount(2);

      expect(container.read(pendingProvider).offlineQueueCount, equals(2));
    });
  });

  // --- Rules provider ---

  group('rulesProvider', () {
    test('rulesProvider_Init_FetchesFromServer', () async {
      final dataSource = _FakeRulesDataSource(rules: [
        {'id': 'r1', 'name': 'Rule 1'},
      ]);
      final container = ProviderContainer(overrides: [
        rulesProvider.overrideWith((ref) => RulesNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      await container.read(rulesProvider.notifier).fetch();

      expect(container.read(rulesProvider).rules.length, equals(1));
    });

    test('rulesProvider_Create_OptimisticUpdate', () async {
      final dataSource = _FakeRulesDataSource(rules: []);
      final container = ProviderContainer(overrides: [
        rulesProvider.overrideWith((ref) => RulesNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      final future = container.read(rulesProvider.notifier).create({'name': 'New', 'authLevel': 'biometric'});

      // Optimistic: appears immediately (before server responds)
      expect(container.read(rulesProvider).rules.length, equals(1));

      await future;
      expect(container.read(rulesProvider).rules.first['name'], equals('New'));
    });

    test('rulesProvider_Delete_OptimisticRemove', () async {
      final dataSource = _FakeRulesDataSource(rules: [
        {'id': 'r1', 'name': 'To Delete'},
      ]);
      final container = ProviderContainer(overrides: [
        rulesProvider.overrideWith((ref) => RulesNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);
      await container.read(rulesProvider.notifier).fetch();

      final future = container.read(rulesProvider.notifier).delete('r1');

      // Optimistic: removed immediately
      expect(container.read(rulesProvider).rules, isEmpty);

      await future;
    });

    test('rulesProvider_CreateFails_RollsBack', () async {
      final dataSource = _FakeRulesDataSource(rules: [], shouldFailCreate: true);
      final container = ProviderContainer(overrides: [
        rulesProvider.overrideWith((ref) => RulesNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      final result = await container.read(rulesProvider.notifier).create({'name': 'Fail'});

      expect(result, isFalse);
      expect(container.read(rulesProvider).rules, isEmpty); // Rolled back
    });

    test('rulesProvider_DeleteFails_RollsBack', () async {
      final dataSource = _FakeRulesDataSource(
        rules: [{'id': 'r1', 'name': 'Keep'}],
        shouldFailDelete: true,
      );
      final container = ProviderContainer(overrides: [
        rulesProvider.overrideWith((ref) => RulesNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);
      await container.read(rulesProvider.notifier).fetch();

      final result = await container.read(rulesProvider.notifier).delete('r1');

      expect(result, isFalse);
      expect(container.read(rulesProvider).rules.length, equals(1)); // Rolled back
    });
  });
}

class _FakePendingDataSource implements PendingDataSource {
  final List<Map<String, dynamic>> cached;
  List<Map<String, dynamic>> remote;
  final bool shouldFail;

  _FakePendingDataSource({
    this.cached = const [],
    List<Map<String, dynamic>>? remote,
    this.shouldFail = false,
  }) : remote = remote ?? [];

  @override
  List<Map<String, dynamic>> getCached() => cached;

  @override
  Future<List<Map<String, dynamic>>> fetchPending() async {
    if (shouldFail) throw Exception('Network error');
    return remote;
  }
}

class _FakeRulesDataSource implements RulesDataSource {
  List<Map<String, dynamic>> rules;
  final bool shouldFailCreate;
  final bool shouldFailDelete;

  _FakeRulesDataSource({
    this.rules = const [],
    this.shouldFailCreate = false,
    this.shouldFailDelete = false,
  });

  @override
  Future<List<Map<String, dynamic>>> fetchRules() async => rules;

  @override
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data) async {
    if (shouldFailCreate) throw Exception('Create failed');
    final created = {...data, 'id': 'r-created'};
    rules = [...rules, created];
    return created;
  }

  @override
  Future<void> deleteRule(String id) async {
    if (shouldFailDelete) throw Exception('Delete failed');
    rules = rules.where((r) => r['id'] != id).toList();
  }
}
