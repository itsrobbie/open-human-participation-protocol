import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/history/history_screen.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';

void main() {
  Widget buildHistory({
    List<Map<String, dynamic>> entries = const [],
    int totalCount = 0,
    bool isLoading = false,
    String? error,
    ThemeData? theme,
  }) {
    final notifier = _TestHistoryNotifier(
      entries: entries,
      totalCount: totalCount,
      isLoading: isLoading,
      error: error,
    );
    return ProviderScope(
      overrides: [
        historyProvider.overrideWith((ref) => notifier),
      ],
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: const HistoryScreen(),
      ),
    );
  }

  Map<String, dynamic> makeEntry({
    String id = 'h1',
    String appId = 'pizza.example.com',
    String summary = 'Approve order',
    String status = 'resolved',
    String decision = 'approve',
    String? ruleName,
    String timestamp = '2026-08-15T10:00:00Z',
  }) {
    return {
      'id': id,
      'appId': appId,
      'summary': summary,
      'status': status,
      'decision': decision,
      'ruleName': ruleName,
      'timestamp': timestamp,
      'deviceName': 'iPhone 16',
    };
  }

  group('HistoryScreen', () {
    testWidgets('History_WithEntries_ShowsCards', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Approve order'),
          makeEntry(id: 'h2', summary: 'Transfer funds', appId: 'bank.example.com'),
        ],
        totalCount: 2,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('history-card-0')), findsOneWidget);
      expect(find.byKey(const Key('history-card-1')), findsOneWidget);
      expect(find.text('Approve order'), findsOneWidget);
      expect(find.text('Transfer funds'), findsOneWidget);
    });

    testWidgets('History_Empty_ShowsEmptyState', (tester) async {
      await tester.pumpWidget(buildHistory());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('history-empty')), findsOneWidget);
      expect(find.text('No history yet'), findsOneWidget);
    });

    testWidgets('History_Search_FiltersResults', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Approve pizza order', appId: 'food.example.com'),
          makeEntry(id: 'h2', summary: 'Transfer bank funds', appId: 'bank.example.com'),
        ],
        totalCount: 2,
      ));
      await tester.pumpAndSettle();

      // Verify both cards are visible before search
      expect(find.text('Approve pizza order'), findsOneWidget);
      expect(find.text('Transfer bank funds'), findsOneWidget);

      // Tap search icon to open search
      await tester.tap(find.byKey(const Key('history-search-toggle')));
      await tester.pumpAndSettle();

      // Verify search field appears
      expect(find.byKey(const Key('history-search-field')), findsOneWidget);

      // Type search query
      await tester.enterText(find.byKey(const Key('history-search-field')), 'pizza');
      await tester.pumpAndSettle();

      // After filtering, only matching entry should remain
      expect(find.text('Approve pizza order'), findsOneWidget);
      expect(find.text('Transfer bank funds'), findsNothing);
    });

    testWidgets('History_StatusFilter_FiltersResults', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Resolved one', status: 'resolved'),
          makeEntry(id: 'h2', summary: 'Expired one', status: 'expired'),
        ],
        totalCount: 2,
      ));
      await tester.pumpAndSettle();

      // Tap filter chip for 'expired'
      await tester.tap(find.byKey(const Key('history-filter-expired')));
      await tester.pumpAndSettle();

      expect(find.text('Expired one'), findsOneWidget);
      expect(find.text('Resolved one'), findsNothing);
    });

    testWidgets('History_AutoResponded_ShowsRuleBadge', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Auto approve', ruleName: 'Low value orders'),
        ],
        totalCount: 1,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('history-rule-badge-0')), findsOneWidget);
      expect(find.text('Low value orders'), findsOneWidget);
    });

    testWidgets('History_TapCard_NavigatesToDetail', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(ProviderScope(
        overrides: [
          historyProvider.overrideWith((ref) {
            return _TestHistoryNotifier(
              entries: [makeEntry()],
              totalCount: 1,
            );
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: HistoryScreen(
            onEntryTap: (_) => tapped = true,
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('history-card-0')));
      await tester.pumpAndSettle();
      expect(tapped, isTrue);
    });

    testWidgets('History_ScrollBottom_LoadsNextPage', (tester) async {
      final entries = List.generate(
        20,
        (i) => makeEntry(id: 'h$i', summary: 'Entry $i'),
      );
      await tester.pumpWidget(buildHistory(
        entries: entries,
        totalCount: 40, // more than current, so hasMore = true
      ));
      await tester.pumpAndSettle();

      // The list should render with a load-more widget at the end since hasMore
      // is true (entries.length=20 < totalCount=40)
      final listFinder = find.byKey(const Key('history-list'));
      expect(listFinder, findsOneWidget);

      // Drag the list up to scroll toward bottom
      await tester.drag(listFinder, const Offset(0, -5000));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // The load-more indicator should be visible at the bottom
      expect(find.byKey(const Key('history-load-more')), findsOneWidget);
    });
  });

  group('Golden tests - history', () {
    testWidgets('history_populated_light', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Approve order for \$45.00', appId: 'pizza.example.com'),
          makeEntry(id: 'h2', summary: 'Transfer to John', appId: 'bank.example.com', status: 'resolved'),
          makeEntry(id: 'h3', summary: 'Sign document', appId: 'docs.example.com', status: 'expired'),
        ],
        totalCount: 3,
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_populated_light.png'),
      );
    });

    testWidgets('history_populated_dark', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Approve order for \$45.00', appId: 'pizza.example.com'),
          makeEntry(id: 'h2', summary: 'Transfer to John', appId: 'bank.example.com', status: 'resolved'),
        ],
        totalCount: 2,
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_populated_dark.png'),
      );
    });

    testWidgets('history_empty_light', (tester) async {
      await tester.pumpWidget(buildHistory());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_empty_light.png'),
      );
    });

    testWidgets('history_empty_dark', (tester) async {
      await tester.pumpWidget(buildHistory(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_empty_dark.png'),
      );
    });

    testWidgets('history_filtered_light', (tester) async {
      await tester.pumpWidget(buildHistory(
        entries: [
          makeEntry(id: 'h1', summary: 'Expired request', status: 'expired'),
        ],
        totalCount: 1,
      ));
      await tester.pumpAndSettle();

      // Tap the expired filter
      await tester.tap(find.byKey(const Key('history-filter-expired')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_filtered_light.png'),
      );
    });
  });
}

class _TestHistoryNotifier extends HistoryNotifier {
  _TestHistoryNotifier({
    List<Map<String, dynamic>> entries = const [],
    int totalCount = 0,
    bool isLoading = false,
    String? error,
  }) : super(dataSource: _StaticHistorySource(entries, totalCount)) {
    state = HistoryState(
      entries: entries,
      totalCount: totalCount,
      isLoading: isLoading,
      error: error,
    );
  }

  @override
  Future<void> fetchFirstPage() async {}

  @override
  Future<void> loadMore() async {}
}

class _StaticHistorySource implements HistoryDataSource {
  final List<Map<String, dynamic>> _entries;
  final int _totalCount;

  _StaticHistorySource(this._entries, this._totalCount);

  @override
  Future<Map<String, dynamic>> fetchHistory({required int page, required int pageSize}) async {
    return {'items': _entries, 'totalCount': _totalCount};
  }
}
