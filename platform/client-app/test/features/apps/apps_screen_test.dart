import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/apps/apps_screen.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';

void main() {
  Widget buildApps({
    List<Map<String, dynamic>> apps = const [],
    bool isLoading = false,
    String? error,
    ThemeData? theme,
  }) {
    final notifier = _TestAppsNotifier(apps: apps, isLoading: isLoading, error: error);
    return ProviderScope(
      overrides: [
        appsProvider.overrideWith((ref) => notifier),
      ],
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: const AppsScreen(),
      ),
    );
  }

  Map<String, dynamic> makeApp({
    String appId = 'pizza.example.com',
    String appName = 'Pizza App',
    String registeredAt = '2026-07-01T10:00:00Z',
    bool pushEnabled = true,
  }) {
    return {
      'appId': appId,
      'appName': appName,
      'registeredAt': registeredAt,
      'pushEnabled': pushEnabled,
    };
  }

  group('AppsScreen', () {
    testWidgets('Apps_WithApps_ShowsCards', (tester) async {
      await tester.pumpWidget(buildApps(apps: [
        makeApp(appId: 'pizza.example.com', appName: 'Pizza App'),
        makeApp(appId: 'bank.example.com', appName: 'Bank App'),
      ]));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('app-card-0')), findsOneWidget);
      expect(find.byKey(const Key('app-card-1')), findsOneWidget);
      expect(find.text('Pizza App'), findsOneWidget);
      expect(find.text('Bank App'), findsOneWidget);
    });

    testWidgets('Apps_Empty_ShowsConnectCTA', (tester) async {
      await tester.pumpWidget(buildApps());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('apps-empty')), findsOneWidget);
      expect(find.text('No apps connected'), findsOneWidget);
    });

    testWidgets('Apps_TapCard_ShowsDetailSheet', (tester) async {
      await tester.pumpWidget(buildApps(apps: [makeApp()]));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('app-card-0')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('app-detail-sheet')), findsOneWidget);
      expect(find.text('Pizza App'), findsWidgets);
    });

    testWidgets('Apps_Revoke_ShowsConfirmation', (tester) async {
      await tester.pumpWidget(buildApps(apps: [makeApp()]));
      await tester.pumpAndSettle();

      // Open detail sheet
      await tester.tap(find.byKey(const Key('app-card-0')));
      await tester.pumpAndSettle();

      // Tap revoke button
      await tester.tap(find.byKey(const Key('app-revoke-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('revoke-confirm-dialog')), findsOneWidget);
      expect(find.text('Revoke access'), findsOneWidget);
    });

    testWidgets('Apps_Revoke_Confirmed_RemovesApp', (tester) async {
      await tester.pumpWidget(buildApps(apps: [makeApp()]));
      await tester.pumpAndSettle();

      // Open detail sheet
      await tester.tap(find.byKey(const Key('app-card-0')));
      await tester.pumpAndSettle();

      // Tap revoke
      await tester.tap(find.byKey(const Key('app-revoke-button')));
      await tester.pumpAndSettle();

      // Confirm revoke
      await tester.tap(find.byKey(const Key('revoke-confirm-yes')));
      await tester.pumpAndSettle();

      // App should be gone
      expect(find.byKey(const Key('app-card-0')), findsNothing);
      expect(find.byKey(const Key('apps-empty')), findsOneWidget);
    });

    testWidgets('Apps_FAB_ShowsConnectOptions', (tester) async {
      await tester.pumpWidget(buildApps());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('apps-fab')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('connect-option-qr')), findsOneWidget);
      expect(find.byKey(const Key('connect-option-paste')), findsOneWidget);
    });

    testWidgets('Apps_NotificationToggle_UpdatesPref', (tester) async {
      await tester.pumpWidget(buildApps(apps: [makeApp(pushEnabled: true)]));
      await tester.pumpAndSettle();

      // Open detail sheet
      await tester.tap(find.byKey(const Key('app-card-0')));
      await tester.pumpAndSettle();

      // Toggle notifications off
      final toggle = find.byKey(const Key('app-notification-toggle'));
      expect(toggle, findsOneWidget);
      await tester.tap(toggle);
      await tester.pumpAndSettle();

      // Toggle should now reflect off state
      final switchWidget = tester.widget<Switch>(toggle);
      expect(switchWidget.value, isFalse);
    });
  });

  group('Golden tests - apps', () {
    testWidgets('apps_populated_light', (tester) async {
      await tester.pumpWidget(buildApps(apps: [
        makeApp(appId: 'pizza.example.com', appName: 'Pizza App'),
        makeApp(appId: 'bank.example.com', appName: 'Bank App'),
      ]));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_populated_light.png'),
      );
    });

    testWidgets('apps_populated_dark', (tester) async {
      await tester.pumpWidget(buildApps(
        apps: [
          makeApp(appId: 'pizza.example.com', appName: 'Pizza App'),
          makeApp(appId: 'bank.example.com', appName: 'Bank App'),
        ],
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_populated_dark.png'),
      );
    });

    testWidgets('apps_empty_light', (tester) async {
      await tester.pumpWidget(buildApps());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_empty_light.png'),
      );
    });

    testWidgets('apps_empty_dark', (tester) async {
      await tester.pumpWidget(buildApps(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_empty_dark.png'),
      );
    });

    testWidgets('apps_detail_sheet_light', (tester) async {
      await tester.pumpWidget(buildApps(apps: [makeApp()]));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('app-card-0')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_detail_sheet_light.png'),
      );
    });

    testWidgets('apps_connect_options_light', (tester) async {
      await tester.pumpWidget(buildApps());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('apps-fab')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/apps_connect_options_light.png'),
      );
    });
  });

  _connectViaChallengeTests();
}

class _TestAppsNotifier extends AppsNotifier {
  _TestAppsNotifier({
    List<Map<String, dynamic>> apps = const [],
    bool isLoading = false,
    String? error,
  }) : super(dataSource: _StaticAppsSource(apps)) {
    state = AppsState(apps: apps, isLoading: isLoading, error: error);
  }

  @override
  Future<void> fetchApps() async {}

  @override
  Future<bool> revokeApp(String appId) async {
    state = state.copyWith(
      apps: state.apps.where((a) => a['appId'] != appId).toList(),
    );
    return true;
  }
}

class _StaticAppsSource implements AppsDataSource {
  final List<Map<String, dynamic>> _apps;
  _StaticAppsSource(this._apps);

  @override
  Future<List<Map<String, dynamic>>> fetchApps() async => _apps;

  @override
  Future<void> revokeApp(String appId) async {}

  @override
  Future<void> setNotificationPreference(String appId, bool enabled) async {}

  @override
  Future<Map<String, dynamic>> processChallenge(String base64Payload) async => {};
}

/// Records what connectViaChallenge dispatches, so the regression test for the
/// "parse but never register" bug can assert processChallenge is actually
/// called and the list is refreshed afterwards.
class _RecordingAppsSource implements AppsDataSource {
  final List<Map<String, dynamic>> appsAfterConnect;
  String? processedPayload;
  int fetchCount = 0;
  bool throwOnProcess = false;

  _RecordingAppsSource({this.appsAfterConnect = const []});

  @override
  Future<List<Map<String, dynamic>>> fetchApps() async {
    fetchCount++;
    return appsAfterConnect;
  }

  @override
  Future<void> revokeApp(String appId) async {}

  @override
  Future<void> setNotificationPreference(String appId, bool enabled) async {}

  @override
  Future<Map<String, dynamic>> processChallenge(String base64Payload) async {
    if (throwOnProcess) throw Exception('process failed');
    processedPayload = base64Payload;
    return {'appId': 'demo.app'};
  }
}

void _connectViaChallengeTests() {
  group('AppsNotifier.connectViaChallenge (regression: connect must register)', () {
    test('calls processChallenge with the payload and refreshes the list', () async {
      final source = _RecordingAppsSource(
        appsAfterConnect: [
          {'id': 'reg-1', 'appId': 'demo.app', 'appName': 'Demo', 'isActive': true},
        ],
      );
      final notifier = AppsNotifier(dataSource: source);

      final ok = await notifier.connectViaChallenge('BASE64PAYLOAD');

      expect(ok, isTrue);
      expect(source.processedPayload, 'BASE64PAYLOAD',
          reason: 'the challenge payload must reach the Resolver, not just be parsed');
      expect(source.fetchCount, greaterThanOrEqualTo(1),
          reason: 'the apps list must refresh so the new app appears');
      expect(notifier.state.apps, isNotEmpty);
    });

    test('returns false and records an error when processChallenge fails', () async {
      final source = _RecordingAppsSource()..throwOnProcess = true;
      final notifier = AppsNotifier(dataSource: source);

      final ok = await notifier.connectViaChallenge('BAD');

      expect(ok, isFalse);
      expect(notifier.state.error, isNotNull);
    });
  });
}
