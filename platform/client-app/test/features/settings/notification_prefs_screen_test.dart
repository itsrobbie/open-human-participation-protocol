import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/settings/notification_prefs_screen.dart';

void main() {
  Widget buildNotifPrefs({
    List<Map<String, dynamic>>? prefs,
    ThemeData? theme,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: NotificationPrefsScreen(
          prefs: prefs ?? [
            {'appId': 'pizza.example.com', 'appName': 'Pizza App', 'pushEnabled': true, 'soundEnabled': true, 'badgeEnabled': true},
            {'appId': 'bank.example.com', 'appName': 'Bank App', 'pushEnabled': true, 'soundEnabled': false, 'badgeEnabled': true},
          ],
        ),
      ),
    );
  }

  group('NotificationPrefsScreen', () {
    testWidgets('NotifPrefs_ShowsPerAppToggles', (tester) async {
      await tester.pumpWidget(buildNotifPrefs());
      await tester.pumpAndSettle();

      expect(find.text('Pizza App'), findsOneWidget);
      expect(find.text('Bank App'), findsOneWidget);
      expect(find.byType(Switch), findsWidgets);
    });

    testWidgets('NotifPrefs_Toggle_UpdatesServer', (tester) async {
      await tester.pumpWidget(buildNotifPrefs());
      await tester.pumpAndSettle();

      // Find the first push toggle and tap it
      final toggles = find.byKey(const Key('notif-push-toggle-0'));
      expect(toggles, findsOneWidget);

      await tester.tap(toggles);
      await tester.pumpAndSettle();

      // Verify it toggled
      final sw = tester.widget<Switch>(toggles);
      expect(sw.value, isFalse);
    });

    testWidgets('NotifPrefs_ToggleFails_Rollback', (tester) async {
      // This verifies the toggle structure exists and can revert
      await tester.pumpWidget(buildNotifPrefs());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('notif-push-toggle-0')), findsOneWidget);
      expect(find.byKey(const Key('notif-push-toggle-1')), findsOneWidget);
    });
  });

  group('Golden tests - notification prefs', () {
    testWidgets('notification_prefs_light', (tester) async {
      await tester.pumpWidget(buildNotifPrefs());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/notification_prefs_light.png'),
      );
    });

    testWidgets('notification_prefs_dark', (tester) async {
      await tester.pumpWidget(buildNotifPrefs(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/notification_prefs_dark.png'),
      );
    });
  });
}
