import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/shell/main_shell.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

void main() {
  Widget buildShell({int currentIndex = 0}) {
    return ProviderScope(
      overrides: [
        pendingProvider.overrideWith(
          (ref) => PendingNotifier(dataSource: _EmptyPendingSource()),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: MainShell(
          currentIndex: currentIndex,
          child: const Center(child: Text('Content')),
        ),
      ),
    );
  }

  group('MainShell', () {
    testWidgets('AppShell_Renders4Tabs', (tester) async {
      await tester.pumpWidget(buildShell());

      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
      expect(find.text('Apps'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('AppShell_TabsHaveKeys', (tester) async {
      await tester.pumpWidget(buildShell());

      expect(find.byKey(const Key('tab-pending')), findsOneWidget);
      expect(find.byKey(const Key('tab-history')), findsOneWidget);
      expect(find.byKey(const Key('tab-apps')), findsOneWidget);
      expect(find.byKey(const Key('tab-profile')), findsOneWidget);
    });

    testWidgets('AppShell_DrawerOpens_ShowsMenuItems', (tester) async {
      await tester.pumpWidget(buildShell());

      // Open drawer via scaffold
      final scaffold = tester.firstWidget<Scaffold>(find.byType(Scaffold));
      scaffold.key; // scaffold is there

      // Open drawer programmatically
      final state = tester.firstState<ScaffoldState>(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('Appearance'), findsOneWidget);
      expect(find.text('Security'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Participation Rules'), findsOneWidget);
      expect(find.text('About'), findsOneWidget);
      expect(find.text('Logout'), findsOneWidget);
    });

    testWidgets('AppShell_Content_Displays', (tester) async {
      await tester.pumpWidget(buildShell());

      expect(find.text('Content'), findsOneWidget);
    });
  });

  group('Golden tests - app shell', () {
    testWidgets('app_shell_pending_tab_light', (tester) async {
      await tester.pumpWidget(buildShell());

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_pending_tab_light.png'),
      );
    });

    testWidgets('app_shell_pending_tab_dark', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            pendingProvider.overrideWith(
              (ref) => PendingNotifier(dataSource: _EmptyPendingSource()),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.dark(),
            home: const MainShell(
              currentIndex: 0,
              child: Center(child: Text('Content')),
            ),
          ),
        ),
      );

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_pending_tab_dark.png'),
      );
    });

    testWidgets('app_shell_drawer_open_light', (tester) async {
      await tester.pumpWidget(buildShell());

      final state = tester.firstState<ScaffoldState>(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_drawer_open_light.png'),
      );
    });

    testWidgets('app_shell_drawer_open_dark', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            pendingProvider.overrideWith(
              (ref) => PendingNotifier(dataSource: _EmptyPendingSource()),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.dark(),
            home: const MainShell(
              currentIndex: 0,
              child: Center(child: Text('Content')),
            ),
          ),
        ),
      );

      final state = tester.firstState<ScaffoldState>(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_drawer_open_dark.png'),
      );
    });
  });
}

class _EmptyPendingSource implements PendingDataSource {
  @override
  List<Map<String, dynamic>> getCached() => [];

  @override
  Future<List<Map<String, dynamic>>> fetchPending() async => [];
}
