import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/history/history_detail_screen.dart';

void main() {
  Widget buildDetail({
    required Map<String, dynamic> entry,
    ThemeData? theme,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: HistoryDetailScreen(entry: entry),
      ),
    );
  }

  Map<String, dynamic> makeEntry({
    String id = 'h1',
    String appId = 'pizza.example.com',
    String appName = 'Pizza App',
    String summary = 'Approve order for \$45.00',
    String? description = 'Please approve the pizza order.',
    String status = 'resolved',
    String decision = 'approve',
    String? ruleName,
    String timestamp = '2026-08-15T10:30:00Z',
    String? resolvedAt = '2026-08-15T10:31:00Z',
    String deviceName = 'iPhone 16 Pro',
    String? transactionId,
    String? transactionLabel,
    String? attestationPayload,
    String? deviceSignature,
  }) {
    return {
      'id': id,
      'appId': appId,
      'appName': appName,
      'summary': summary,
      'description': description,
      'status': status,
      'decision': decision,
      'ruleName': ruleName,
      'timestamp': timestamp,
      'resolvedAt': resolvedAt,
      'deviceName': deviceName,
      'transactionId': transactionId,
      'transactionLabel': transactionLabel,
      'attestationPayload': attestationPayload,
      'deviceSignature': deviceSignature,
    };
  }

  group('HistoryDetailScreen', () {
    testWidgets('HistoryDetail_ShowsFullInfo', (tester) async {
      await tester.pumpWidget(buildDetail(entry: makeEntry()));
      await tester.pumpAndSettle();

      expect(find.text('Pizza App'), findsOneWidget);
      expect(find.text('Approve order for \$45.00'), findsOneWidget);
      expect(find.text('Please approve the pizza order.'), findsOneWidget);
      expect(find.text('approve'), findsOneWidget);
      expect(find.text('iPhone 16 Pro'), findsOneWidget);
      expect(find.byKey(const Key('detail-status-badge')), findsOneWidget);
    });

    testWidgets('HistoryDetail_AutoResponded_ShowsRuleName', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(ruleName: 'Low value auto-approve'),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('detail-rule-info')), findsOneWidget);
      expect(find.text('Low value auto-approve'), findsOneWidget);
    });

    testWidgets('HistoryDetail_WithTransaction_ShowsGrouping', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(
          transactionId: 'txn-001',
          transactionLabel: 'Pizza Order #1234',
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('detail-transaction')), findsOneWidget);
      expect(find.text('Pizza Order #1234'), findsOneWidget);
    });

    testWidgets('HistoryDetail_AttestationExpand_ShowsCryptoInfo', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(
          attestationPayload: '{"selectedOption":"approve"}',
          deviceSignature: 'MEUCIQDfake...signature==',
        ),
      ));
      await tester.pumpAndSettle();

      // Attestation section should be collapsed initially
      expect(find.byKey(const Key('detail-attestation-toggle')), findsOneWidget);
      expect(find.text('{"selectedOption":"approve"}'), findsNothing);

      // Tap to expand
      await tester.tap(find.byKey(const Key('detail-attestation-toggle')));
      await tester.pumpAndSettle();

      expect(find.text('{"selectedOption":"approve"}'), findsOneWidget);
      expect(find.text('MEUCIQDfake...signature=='), findsOneWidget);
    });
  });

  group('Golden tests - history detail', () {
    testWidgets('history_detail_light', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(
          attestationPayload: '{"selectedOption":"approve"}',
          deviceSignature: 'MEUCIQDfake...signature==',
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_detail_light.png'),
      );
    });

    testWidgets('history_detail_dark', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(),
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_detail_dark.png'),
      );
    });

    testWidgets('history_detail_auto_responded_light', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(ruleName: 'Low value auto-approve'),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_detail_auto_responded_light.png'),
      );
    });

    testWidgets('history_detail_auto_responded_dark', (tester) async {
      await tester.pumpWidget(buildDetail(
        entry: makeEntry(ruleName: 'Low value auto-approve'),
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/history_detail_auto_responded_dark.png'),
      );
    });
  });
}
