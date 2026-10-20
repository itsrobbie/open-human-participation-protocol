import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';
import 'package:ohpp_client/shared/providers/user_profile_provider.dart';

void main() {
  // --- userProfileProvider (Step 25 gap) ---

  group('userProfileProvider', () {
    test('userProfileProvider_Authenticated_FetchesProfile', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(authProvider.notifier).login(userId: 'user-1', accessToken: 'token');

      final profile = await container.read(userProfileProvider.future);

      expect(profile, isNotNull);
      expect(profile!.userId, equals('user-1'));
    });

    test('userProfileProvider_Unauthenticated_ReturnsNull', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final profile = await container.read(userProfileProvider.future);

      expect(profile, isNull);
    });
  });

  // --- historyProvider (Step 26 gap) ---

  group('historyProvider', () {
    test('historyProvider_Init_ReturnsFirstPage', () async {
      final dataSource = _FakeHistoryDataSource(pages: {
        1: [{'id': 'h1'}, {'id': 'h2'}],
      }, totalCount: 5);
      final container = ProviderContainer(overrides: [
        historyProvider.overrideWith((ref) => HistoryNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      await container.read(historyProvider.notifier).fetchFirstPage();

      final state = container.read(historyProvider);
      expect(state.entries.length, equals(2));
      expect(state.page, equals(1));
      expect(state.totalCount, equals(5));
    });

    test('historyProvider_LoadMore_AppendsNextPage', () async {
      final dataSource = _FakeHistoryDataSource(pages: {
        1: [{'id': 'h1'}, {'id': 'h2'}],
        2: [{'id': 'h3'}, {'id': 'h4'}],
      }, totalCount: 4);
      final container = ProviderContainer(overrides: [
        historyProvider.overrideWith((ref) => HistoryNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      await container.read(historyProvider.notifier).fetchFirstPage();
      await container.read(historyProvider.notifier).loadMore();

      final state = container.read(historyProvider);
      expect(state.entries.length, equals(4));
      expect(state.page, equals(2));
    });

    test('historyProvider_LoadMore_DoesNotLoadBeyondTotal', () async {
      final dataSource = _FakeHistoryDataSource(pages: {
        1: [{'id': 'h1'}],
      }, totalCount: 1);
      final container = ProviderContainer(overrides: [
        historyProvider.overrideWith((ref) => HistoryNotifier(dataSource: dataSource)),
      ]);
      addTearDown(container.dispose);

      await container.read(historyProvider.notifier).fetchFirstPage();
      await container.read(historyProvider.notifier).loadMore();

      // Should not have fetched more (hasMore is false)
      expect(dataSource.fetchCount, equals(1)); // Only first page
    });
  });
}

class _FakeHistoryDataSource implements HistoryDataSource {
  final Map<int, List<Map<String, dynamic>>> pages;
  final int totalCount;
  int fetchCount = 0;

  _FakeHistoryDataSource({required this.pages, required this.totalCount});

  @override
  Future<Map<String, dynamic>> fetchHistory({required int page, required int pageSize}) async {
    fetchCount++;
    return {
      'items': pages[page] ?? [],
      'totalCount': totalCount,
      'page': page,
    };
  }
}
