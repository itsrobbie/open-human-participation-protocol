import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/profile/profile_screen.dart';

void main() {
  Widget buildProfile({
    Map<String, dynamic>? user,
    List<Map<String, dynamic>> devices = const [],
    ThemeData? theme,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: ProfileScreen(
          user: user ?? {
            'username': 'robbie.burke',
            'email': 'robbie@example.com',
            'resolverUrl': 'https://resolver.ohpp.dev',
          },
          devices: devices.isEmpty
              ? [
                  {'deviceId': 'd1', 'name': 'iPhone 16 Pro', 'keyLevel': 'secureEnclave', 'isCurrent': true},
                  {'deviceId': 'd2', 'name': 'iPad Air', 'keyLevel': 'secureEnclave', 'isCurrent': false},
                ]
              : devices,
        ),
      ),
    );
  }

  group('ProfileScreen', () {
    testWidgets('Profile_ShowsUsername', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      expect(find.text('robbie.burke'), findsOneWidget);
    });

    testWidgets('Profile_ShowsResolverUrl', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      expect(find.text('https://resolver.ohpp.dev'), findsOneWidget);
    });

    testWidgets('Profile_ShowsDeviceList', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      expect(find.text('iPhone 16 Pro'), findsOneWidget);
      expect(find.text('iPad Air'), findsOneWidget);
    });

    testWidgets('Profile_ThisDevice_HasBadge', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('device-current-badge')), findsOneWidget);
    });

    testWidgets('Profile_DeviceCard_ShowsKeyLevel', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      expect(find.text('Secure Enclave'), findsWidgets);
    });

    // Bug 2: Settings was unreachable (drawer had no opener). The Profile
    // screen must expose a discoverable Settings entry point.
    testWidgets('Profile_HasSettingsButton_ThatNavigates', (tester) async {
      var opened = false;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light(),
            home: ProfileScreen(
              user: const {'username': 'demo', 'email': '', 'resolverUrl': ''},
              devices: const [],
              onOpenSettings: () => opened = true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final settingsBtn = find.byKey(const Key('profile-settings-button'));
      expect(settingsBtn, findsOneWidget,
          reason: 'Profile must offer a way to reach Settings');

      await tester.tap(settingsBtn);
      await tester.pumpAndSettle();
      expect(opened, isTrue, reason: 'tapping settings navigates to Settings');
    });
  });

  group('Golden tests - profile', () {
    testWidgets('profile_light', (tester) async {
      await tester.pumpWidget(buildProfile());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/profile_light.png'),
      );
    });

    testWidgets('profile_dark', (tester) async {
      await tester.pumpWidget(buildProfile(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/profile_dark.png'),
      );
    });
  });
}
