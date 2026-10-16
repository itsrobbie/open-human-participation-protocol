import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';

/// Dedicated authentication test: proves the login flow works end to end
/// against the real Keycloak, through the app's UI. This is the ONE place the
/// UI login is exercised; every other feature test starts already authenticated
/// via [E2EHarness.buildAppSignedIn] to avoid paying the login cost each time.
///
/// Run on a simulator against the dev stack: `make flutter-test-e2e`.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  Future<void> pumpUntil(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 500));
      if (finder.evaluate().isNotEmpty) return;
    }
    await tester.pumpAndSettle();
  }

  Future<void> enterCredentials(
    WidgetTester tester,
    String username,
    String password,
  ) async {
    await tester.enterText(find.byKey(const Key('login-username')), username);
    await tester.enterText(find.byKey(const Key('login-password')), password);
    await tester.pumpAndSettle();
    // Close the keyboard without submitting via the keyboard action (which
    // would double-submit and remove the button before we can tap it).
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    final submit = find.byKey(const Key('login-submit'));
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
  }

  testWidgets('login: valid credentials authenticate and reach Pending',
      (tester) async {
    // A device token is needed for the app's data sources, but login itself
    // does not depend on it; register one up front.
    final identity = await getAccessToken();
    expect(identity, isNotNull, reason: 'demo user should exist in Keycloak');
    final device = await setupDevice(identity!);
    final harness = E2EHarness.create(deviceToken: device!.deviceToken);

    await tester.pumpWidget(harness.buildAppForLogin(deviceToken: device.deviceToken));
    await tester.pumpAndSettle();

    // Login screen is shown.
    expect(find.byKey(const Key('login-username')), findsOneWidget);

    await enterCredentials(tester, e2eTestUsername, e2eTestPassword);
    await pumpUntil(tester, find.text('Pending'));

    expect(find.text('Pending'), findsWidgets,
        reason: 'valid login should navigate to the Pending screen');
  });

  testWidgets('login: invalid credentials are rejected', (tester) async {
    final identity = await getAccessToken();
    final device = await setupDevice(identity!);
    final harness = E2EHarness.create(deviceToken: device!.deviceToken);

    await tester.pumpWidget(harness.buildAppForLogin(deviceToken: device.deviceToken));
    await tester.pumpAndSettle();

    await enterCredentials(tester, e2eTestUsername, 'wrong-password');
    // Give the failed grant time to return.
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    // Still on the login screen (did not navigate to Pending).
    expect(find.byKey(const Key('login-username')), findsOneWidget,
        reason: 'invalid credentials must not authenticate');
  });
}
