import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/pending/pending_screen.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

void main() {
  Widget buildPending({
    List<Map<String, dynamic>> requests = const [],
    bool isLoading = false,
    String? error,
    int queueCount = 0,
  }) {
    return ProviderScope(
      overrides: [
        pendingProvider.overrideWith((ref) {
          final notifier = PendingNotifier(dataSource: _StaticSource(requests));
          if (queueCount > 0) notifier.updateQueueCount(queueCount);
          return notifier;
        }),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const PendingScreen()),
    );
  }

  group('PendingScreen', () {
    testWidgets('Pending_WithRequests_ShowsCards', (tester) async {
      await tester.pumpWidget(buildPending(requests: [
        {'requestId': 'r1', 'appId': 'pizza.test', 'summary': 'Approve order', 'type': 'select'},
        {'requestId': 'r2', 'appId': 'bank.test', 'summary': 'Transfer \$100', 'type': 'select'},
      ]));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pending-card-0')), findsOneWidget);
      expect(find.byKey(const Key('pending-card-1')), findsOneWidget);
      expect(find.text('Approve order'), findsOneWidget);
      expect(find.text('Transfer \$100'), findsOneWidget);
    });

    testWidgets('Pending_Empty_ShowsEmptyState', (tester) async {
      await tester.pumpWidget(buildPending());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pending-empty')), findsOneWidget);
      expect(find.text('All clear'), findsOneWidget);
    });

    testWidgets('Pending_QueueBadge_ShowsCount', (tester) async {
      await tester.pumpWidget(buildPending(queueCount: 3));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pending-queue-badge')), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('Pending_UrgentRequest_ShowsBadge', (tester) async {
      final urgentExpiry = DateTime.now().add(const Duration(minutes: 10)).toIso8601String();
      await tester.pumpWidget(buildPending(requests: [
        {'requestId': 'r1', 'appId': 'bank.test', 'summary': 'Urgent', 'type': 'select', 'expiry': urgentExpiry},
      ]));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('urgent-badge')), findsOneWidget);
    });
  });

  group('Golden tests - pending', () {
    testWidgets('pending_populated_light', (tester) async {
      await tester.pumpWidget(buildPending(requests: [
        {'requestId': 'r1', 'appId': 'pizza.example.com', 'summary': 'Approve order for \$45.00', 'type': 'select'},
        {'requestId': 'r2', 'appId': 'bank.example.com', 'summary': 'Transfer to John Smith', 'type': 'select'},
      ]));
      await tester.pumpAndSettle();

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/pending_populated_light.png'));
    });

    testWidgets('pending_empty_light', (tester) async {
      await tester.pumpWidget(buildPending());
      await tester.pumpAndSettle();

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/pending_empty_light.png'));
    });
  });
}

class _StaticSource implements PendingDataSource {
  final List<Map<String, dynamic>> data;
  _StaticSource(this.data);

  @override
  List<Map<String, dynamic>> getCached() => data;

  @override
  Future<List<Map<String, dynamic>>> fetchPending() async => data;
}
