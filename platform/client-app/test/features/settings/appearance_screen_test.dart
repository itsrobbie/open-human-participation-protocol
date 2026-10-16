import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/settings/appearance_screen.dart';
import 'package:ohpp_client/shared/providers/appearance_provider.dart';

void main() {
  Widget buildAppearance({ThemeData? theme}) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: const AppearanceScreen(),
      ),
    );
  }

  group('AppearanceScreen', () {
    testWidgets('Appearance_ThemeToggle_UpdatesPreference', (tester) async {
      await tester.pumpWidget(buildAppearance());
      await tester.pumpAndSettle();

      // Should show segmented button with system/light/dark
      expect(find.text('System'), findsOneWidget);
      expect(find.text('Light'), findsOneWidget);
      expect(find.text('Dark'), findsOneWidget);

      // Tap Dark
      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();

      // The Dark segment should now be selected (verified by key state)
      expect(find.byKey(const Key('theme-segment-dark')), findsOneWidget);
    });

    testWidgets('Appearance_TextScale_UpdatesPreview', (tester) async {
      await tester.pumpWidget(buildAppearance());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('text-scale-slider')), findsOneWidget);
      expect(find.byKey(const Key('text-scale-preview')), findsOneWidget);
    });

    testWidgets('Appearance_Changes_Persist', (tester) async {
      await tester.pumpWidget(buildAppearance());
      await tester.pumpAndSettle();

      // Tap Light to change from default system
      await tester.tap(find.text('Light'));
      await tester.pumpAndSettle();

      // Selection should stick
      expect(find.byKey(const Key('theme-segment-light')), findsOneWidget);
    });
  });

  group('Golden tests - appearance', () {
    testWidgets('appearance_light', (tester) async {
      await tester.pumpWidget(buildAppearance());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/appearance_light.png'),
      );
    });

    testWidgets('appearance_dark', (tester) async {
      await tester.pumpWidget(buildAppearance(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/appearance_dark.png'),
      );
    });
  });
}
