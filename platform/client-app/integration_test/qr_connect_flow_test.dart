import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ohpp_client/core/navigation/app_router.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// QR connect whole-case (production-lifecycle plan, Phase 2.2 — the QR half),
/// on the settled account-creation model: the IdP is hidden and everything is
/// driven through the app against the resolver. A freshly-signed-up user obtains
/// a REAL `ohpp://register?challenge=` URI from the resolver's dev-only
/// connect-challenge endpoint (no demo app, no Keycloak page), then connects
/// through the app's OWN QR scanner — the production scan path via the P7 camera
/// seam — and the resolver records the connection.
///
///   1. sign up in-app
///   2. GET /api/protocol-lab/connect-challenge -> real ohpp://register URI
///   3. Apps tab -> connect (QR) -> scanner -> inject the URI via the keyed
///      'scanner-simulate-detect' seam -> the app calls connectViaChallenge
///   4. the connected app shows in the Apps list (and the resolver reports it)
///
/// Run on a wired device:
///   make flutter-e2e-device FLUTTER_E2E_TESTS=qr_connect_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets('scan a real challenge QR -> the app connects',
      (tester) async {
    final driver = OhppLifecycleDriver(tester);

    final seedIdentity = await getAccessToken();
    expect(seedIdentity, isNotNull);
    final seedDevice = await setupDevice(seedIdentity!);
    expect(seedDevice, isNotNull);

    final harness = E2EHarness.create(deviceToken: seedDevice!.deviceToken);
    await tester.pumpWidget(harness.buildAppForAuth(deviceToken: seedDevice.deviceToken));
    await tester.pumpAndSettle();

    // --- Arrange: a brand-new user signs up in-app. ---
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_qr_$unique';
    final password = 'Pw-$unique!';
    await driver.registerViaApp(username, '$username@example.com', password);
    final identity = await getAccessTokenFor(username, password);
    expect(identity, isNotNull);

    // --- Act 1: obtain a REAL scannable challenge URI from the resolver. ---
    final challengeUri = await fetchLabConnectChallengeUri(identityToken: identity!);
    expect(challengeUri, isNotNull,
        reason: 'the resolver dev endpoint should mint an ohpp://register URI');
    expect(challengeUri, startsWith('ohpp://register?challenge='));

    // Inject it as the value the QR scanner's P7 seam will emit on detect.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MaterialApp)),
    );
    container.read(qrTestScanValueProvider.notifier).state = challengeUri;

    // --- Act 2: connect through the app's OWN QR scanner UI. ---
    await driver.connectAppByQrScan();

    // --- Assert: the connected app shows in the Apps list. ---
    await driver.openAppsAndWaitForCard();
    expect(find.byKey(const Key('app-card-0')), findsOneWidget,
        reason: 'the app connected via QR scan should render in the Apps list');

    // Audit by construction: the RESOLVER recorded the registration, not just
    // the local UI.
    final apps = await getRegisteredApps(identity);
    expect(apps.any((a) => a['appId'] == 'protocol-lab.dev.test'), isTrue,
        reason: 'the resolver should report the Lab app as connected after the scan');
  });
}
