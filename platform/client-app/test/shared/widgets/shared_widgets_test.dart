import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/shared/widgets/shared_widgets.dart';

void main() {
  Widget wrap(Widget child, {ThemeData? theme}) {
    return MaterialApp(
      theme: theme ?? AppTheme.light(),
      home: Scaffold(
        body: Center(child: child),
      ),
    );
  }

  group('Golden tests - urgency badge', () {
    testWidgets('urgency_badge_normal', (tester) async {
      // More than 15 minutes - no badge shown
      await tester.pumpWidget(wrap(
        UrgencyBadge(expiry: DateTime.now().add(const Duration(hours: 1))),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/urgency_badge_normal.png'),
      );
    });

    testWidgets('urgency_badge_15min', (tester) async {
      await tester.pumpWidget(wrap(
        UrgencyBadge(expiry: DateTime.now().add(const Duration(minutes: 10))),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/urgency_badge_15min.png'),
      );
    });

    testWidgets('urgency_badge_5min', (tester) async {
      await tester.pumpWidget(wrap(
        UrgencyBadge(expiry: DateTime.now().add(const Duration(minutes: 3))),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/urgency_badge_5min.png'),
      );
    });

    testWidgets('urgency_badge_expired', (tester) async {
      await tester.pumpWidget(wrap(
        UrgencyBadge(expiry: DateTime.now().subtract(const Duration(minutes: 5))),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/urgency_badge_expired.png'),
      );
    });
  });

  group('Golden tests - status badge', () {
    testWidgets('status_badge_pending', (tester) async {
      await tester.pumpWidget(wrap(const StatusBadge(status: 'pending')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/status_badge_pending.png'),
      );
    });

    testWidgets('status_badge_resolved', (tester) async {
      await tester.pumpWidget(wrap(const StatusBadge(status: 'resolved')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/status_badge_resolved.png'),
      );
    });

    testWidgets('status_badge_expired', (tester) async {
      await tester.pumpWidget(wrap(const StatusBadge(status: 'expired')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/status_badge_expired.png'),
      );
    });

    testWidgets('status_badge_auto_responded', (tester) async {
      await tester.pumpWidget(wrap(const StatusBadge(status: 'auto_responded')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/status_badge_auto_responded.png'),
      );
    });
  });

  group('Golden tests - type badge', () {
    testWidgets('type_badge_all_types', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: Center(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                TypeBadge(type: 'select'),
                TypeBadge(type: 'multiselect'),
                TypeBadge(type: 'text'),
                TypeBadge(type: 'number'),
                TypeBadge(type: 'date'),
                TypeBadge(type: 'datetime'),
                TypeBadge(type: 'signature'),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/type_badge_all_types.png'),
      );
    });
  });

  group('Golden tests - offline indicator', () {
    testWidgets('offline_indicator', (tester) async {
      await tester.pumpWidget(wrap(const OfflineIndicator()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/offline_indicator.png'),
      );
    });
  });

  group('Golden tests - loading skeleton', () {
    testWidgets('loading_skeleton', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(body: LoadingSkeleton()),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/loading_skeleton.png'),
      );
    });
  });

  group('Golden tests - empty state', () {
    testWidgets('empty_state_generic', (tester) async {
      await tester.pumpWidget(wrap(
        const EmptyState(
          icon: Icons.inbox_outlined,
          title: 'Nothing here',
          subtitle: 'Check back later for new items.',
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/empty_state_generic.png'),
      );
    });
  });

  group('Golden tests - error state', () {
    testWidgets('error_state_generic', (tester) async {
      await tester.pumpWidget(wrap(
        ErrorState(
          message: 'Failed to load data. Please try again.',
          onRetry: () {},
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/error_state_generic.png'),
      );
    });
  });
}
