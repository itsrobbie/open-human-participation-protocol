import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// App-connect lifecycle whole-case (production-lifecycle plan, Phase 2.2),
/// against the real dev stack. Proves the connected-app lifecycle a user drives
/// after signing up: an app is connected, shows in the Apps tab, and can be
/// REVOKED through the keyed UI, after which it is gone.
///
/// Scope note: the CONNECT is done via the Protocol Lab's per-user registration
/// (the only app-connect path valid for a freshly-created account — the demo
/// requester apps bind challenges to their own realms, which a new ohpp-realm
/// user is not in). The user-facing lifecycle action under test is the REVOKE,
/// driven entirely through the keyed Apps UI. The paste-challenge PARSER itself
/// is covered by e2e_flows_test (invalid + expired inputs).
///
/// Run on a wired device:
///   make flutter-e2e-device FLUTTER_E2E_TESTS=app_connect_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets('connect an app -> it shows in Apps -> revoke -> it is gone',
      (tester) async {
    final driver = OhppLifecycleDriver(tester);

    final seedIdentity = await getAccessToken();
    final seedDevice = await setupDevice(seedIdentity!);
    final harness = E2EHarness.create(deviceToken: seedDevice!.deviceToken);
    await tester.pumpWidget(harness.buildAppForAuth(deviceToken: seedDevice.deviceToken));
    await tester.pumpAndSettle();

    // --- Arrange: a brand-new user signs up in-app. ---
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_$unique';
    final password = 'Pw-$unique!';
    await driver.registerViaApp(username, '$username@example.com', password);

    // --- Act 1: connect an app for this user (per-user connect path). ---
    final identity = await getAccessTokenFor(username, password);
    expect(identity, isNotNull);
    final connected = await connectLabApp(identityToken: identity!);
    expect(connected, isTrue, reason: 'connecting the Lab app should succeed');

    // --- Assert 1: the connected app shows in the Apps tab. ---
    await driver.openAppsAndWaitForCard();
    expect(find.byKey(const Key('app-card-0')), findsOneWidget,
        reason: 'the connected app should render in the Apps list');

    // --- Act 2: revoke it through the keyed UI. ---
    await driver.revokeFirstApp();

    // --- Assert 2: the Apps tab is now empty. ---
    await driver.assertNoApps();
    expect(find.byKey(const Key('apps-empty')), findsOneWidget,
        reason: 'after revoke the Apps list should be empty');

    // --- Assert 3 (audit by construction, P5): the RESOLVER dropped the
    // registration, not just the UI. Query the backend for this identity and
    // confirm no active app registration remains. ---
    final remaining = await getRegisteredApps(identity);
    expect(remaining, isEmpty,
        reason: 'the Resolver should report no active app registrations after revoke');
  });
}
