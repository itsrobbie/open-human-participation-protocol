import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/shared/providers/appearance_provider.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/connectivity_provider.dart';
import 'package:ohpp_client/shared/providers/telemetry_provider.dart';

void main() {
  group('authProvider', () {
    test('authProvider_Login_EmitsAuthenticated', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(authProvider.notifier).login(
        userId: 'user-1',
        accessToken: 'token-abc',
      );

      final state = container.read(authProvider);
      expect(state.state, equals(AuthState.authenticated));
      expect(state.userId, equals('user-1'));
      expect(state.accessToken, equals('token-abc'));
    });

    test('authProvider_Logout_EmitsUnauthenticated', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(authProvider.notifier).login(userId: 'u', accessToken: 't');
      container.read(authProvider.notifier).logout();

      final state = container.read(authProvider);
      expect(state.state, equals(AuthState.unauthenticated));
      expect(state.userId, isNull);
    });

    test('authProvider_TokenRefresh_UpdatesSilently', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(authProvider.notifier).login(userId: 'u', accessToken: 'old');
      container.read(authProvider.notifier).refreshToken('new_token');

      final state = container.read(authProvider);
      expect(state.state, equals(AuthState.authenticated));
      expect(state.accessToken, equals('new_token'));
      expect(state.userId, equals('u')); // Unchanged
    });
  });

  group('connectivityProvider', () {
    test('connectivityProvider_Online_EmitsOnline', () {
      final controller = StreamController<ConnectivityState>();
      final container = ProviderContainer(overrides: [
        connectivityProvider.overrideWith(
          (ref) => ConnectivityNotifier(stream: controller.stream),
        ),
      ]);
      addTearDown(() {
        container.dispose();
        controller.close();
      });

      // Default is online
      expect(container.read(connectivityProvider), equals(ConnectivityState.online));
    });

    test('connectivityProvider_Offline_EmitsOffline', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(connectivityProvider.notifier).setOffline();

      expect(container.read(connectivityProvider), equals(ConnectivityState.offline));
    });
  });

  group('appearanceProvider', () {
    test('appearanceProvider_ChangeTheme_Persists', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(appearanceProvider.notifier).setThemeMode(ThemeMode.dark);

      expect(container.read(appearanceProvider).themeMode, equals(ThemeMode.dark));
    });

    test('appearanceProvider_DefaultIsSystem', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(appearanceProvider).themeMode, equals(ThemeMode.system));
    });
  });

  group('telemetryProvider', () {
    test('telemetryProvider_OptOut_StopsAnalytics', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(telemetryConsentProvider.notifier).optIn();
      expect(container.read(telemetryConsentProvider), isTrue);

      container.read(telemetryConsentProvider.notifier).optOut();
      expect(container.read(telemetryConsentProvider), isFalse);
    });

    test('telemetryProvider_DefaultNotConsented', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(telemetryConsentProvider), isFalse);
    });
  });
}
