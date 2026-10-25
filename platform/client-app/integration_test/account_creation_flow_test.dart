import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// Account-creation whole-case (production-lifecycle plan, Phase 2.0), against
/// the real dev stack. Proves the TOP of the user lifecycle that did not exist
/// before: a brand-new human with NO account creates one entirely IN-APP, never
/// seeing the identity provider, and lands authenticated and enrolled.
///
/// The app's sign-up form calls the Resolver's /api/auth/register; the Resolver
/// brokers to the configured provider (Keycloak in dev) and returns tokens. The
/// app then enrolls the device. The app names no provider on its auth path.
///
/// Run on a wired device: make flutter-e2e-device FLUTTER_E2E_TESTS=account_creation_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets('new user signs up in-app -> authenticated -> device enrolled',
      (tester) async {
    final driver = OhppLifecycleDriver(tester);

    // A device token is needed to seed the device-scoped API client; the real
    // enrollment re-derives the device from the brokered identity token.
    final seedIdentity = await getAccessToken();
    expect(seedIdentity, isNotNull, reason: 'seed identity for the harness client');
    final seedDevice = await setupDevice(seedIdentity!);
    expect(seedDevice, isNotNull);

    final harness = E2EHarness.create(deviceToken: seedDevice!.deviceToken);
    await tester.pumpWidget(harness.buildAppForAuth(deviceToken: seedDevice.deviceToken));
    await tester.pumpAndSettle();

    // The app boots to the login screen (unauthenticated). A brand-new user has
    // no account, so they follow the in-app register link and sign up. Use a
    // unique username so the run does not collide with a prior one.
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_$unique';
    await driver.registerViaApp(username, '$username@example.com', 'Pw-$unique!');

    // Landed authenticated: the Pending tab (authenticated shell) is shown.
    expect(find.byKey(const Key('tab-pending')), findsOneWidget,
        reason: 'a newly-registered user should land authenticated on Pending');

    // And the account can sign in again through the resolver (proves it was
    // really created at the provider, not just a local session).
    final reauth = await getAccessTokenFor(username, 'Pw-$unique!');
    expect(reauth, isNotNull,
        reason: 'the in-app-created account must authenticate against the realm');
  });
}
