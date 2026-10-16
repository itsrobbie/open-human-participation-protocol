import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/settings/settings_screen.dart';

void main() {
  Widget buildSettings({
    ThemeData? theme,
    void Function(String)? onNavigate,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: SettingsScreen(onNavigate: onNavigate),
      ),
    );
  }

  group('SettingsScreen', () {
    testWidgets('Settings_ShowsAllSections', (tester) async {
      await tester.pumpWidget(buildSettings());
      await tester.pumpAndSettle();

      expect(find.text('Appearance'), findsOneWidget);
      expect(find.text('Security'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Rules'), findsOneWidget);
      expect(find.text('Export data'), findsOneWidget);
      expect(find.text('Delete account'), findsOneWidget);
    });

    testWidgets('Settings_TapAppearance_Navigates', (tester) async {
      String? navigated;
      await tester.pumpWidget(buildSettings(onNavigate: (route) => navigated = route));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Appearance'));
      await tester.pumpAndSettle();

      expect(navigated, 'appearance');
    });

    testWidgets('Settings_DeleteAccount_ShowsConfirmation', (tester) async {
      await tester.pumpWidget(buildSettings());
      await tester.pumpAndSettle();

      // Scroll it into view first (the Developer section pushes it down the list).
      await tester.ensureVisible(find.text('Delete account'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete account'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('delete-account-dialog')), findsOneWidget);
      expect(find.text('Delete your account?'), findsOneWidget);
    });
  });

  group('Golden tests - settings', () {
    testWidgets('settings_light', (tester) async {
      await tester.pumpWidget(buildSettings());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/settings_light.png'),
      );
    });

    testWidgets('settings_dark', (tester) async {
      await tester.pumpWidget(buildSettings(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/settings_dark.png'),
      );
    });
  });
}
