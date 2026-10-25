import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_attester.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// History + profile whole-case (production-lifecycle plan, Phase 2.6), against
/// the real dev stack. After a user signs up and answers a request, the proof
/// must be inspectable in-app:
///
///   1. sign up, raise a request via the Lab, answer it in-app (real ceremony)
///   2. HISTORY: the resolved request appears in the History tab; opening it and
///      expanding the attestation section shows the proof payload (the same
///      signed attestation the resolver recorded).
///   3. PROFILE: the Profile tab shows the enrolled device (current-device badge).
///
/// Scope note: the plan item also lists "notification prefs persist across a
/// restart". The notification-prefs screen holds LOCAL state only (it takes
/// prefs as a constructor arg and toggles an in-memory list, no persistence
/// layer / provider write), so there is no persistence to assert -- that is a
/// not-yet-built feature, folded into the open product decisions rather than
/// asserted here as if it worked.
///
/// Run on a wired device:
///   make flutter-e2e-device FLUTTER_E2E_TESTS=history_profile_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets(
      'resolved request shows in history with proof detail; profile shows the device',
      (tester) async {
    final driver = OhppLifecycleDriver(tester);
    final attester = OhppAttester(tester);

    final seedIdentity = await getAccessToken();
    expect(seedIdentity, isNotNull);
    final seedDevice = await setupDevice(seedIdentity!);
    expect(seedDevice, isNotNull);

    final harness = E2EHarness.create(deviceToken: seedDevice!.deviceToken);
    await tester.pumpWidget(harness.buildAppForAuth(deviceToken: seedDevice.deviceToken));
    await tester.pumpAndSettle();

    // --- Arrange: sign up + answer one request so there is a proof to inspect. ---
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_hist_$unique';
    final password = 'Pw-$unique!';
    await driver.registerViaApp(username, '$username@example.com', password);
    final identity = await getAccessTokenFor(username, password);
    expect(identity, isNotNull);

    await driver.gotoTab('pending');
    final requestId = await raiseLabRequest(identityToken: identity!);
    expect(requestId, isNotNull);
    await driver.refreshUntilCard(requestId!);
    await attester.answerStep(requestId, const SelectStep('approve'));

    // The audit record must exist server-side (P5) before asserting the UI.
    Map<String, dynamic>? record;
    final deadline = DateTime.now().add(const Duration(seconds: 20));
    while (DateTime.now().isBefore(deadline)) {
      record = await fetchParticipationHistoryDetail(
        identityToken: identity,
        requestId: requestId,
      );
      if (record != null && record['resolvedAt'] != null) break;
      await Future<void>.delayed(const Duration(seconds: 1));
    }
    expect(record?['resolvedAt'], isNotNull);

    // --- Assert 1: HISTORY shows the resolved request with proof detail. ---
    await driver.gotoTab('history');
    await driver.refreshPending(); // resumed-refresh to pull the resolved entry
    await pumpUntilKey(tester, 'history-card-0',
        timeout: const Duration(seconds: 20));
    await tester.tap(find.byKey(const Key('history-card-0')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'detail-attestation-toggle');
    await tester.tap(find.byKey(const Key('detail-attestation-toggle')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'detail-attestation-payload');
    expect(find.byKey(const Key('detail-attestation-payload')), findsOneWidget,
        reason: 'the resolved request detail must show the signed attestation payload');

    // --- Assert 2: PROFILE shows the enrolled device. ---
    await driver.gotoTab('profile');
    await pumpUntilKey(tester, 'device-current-badge',
        timeout: const Duration(seconds: 20));
    expect(find.byKey(const Key('device-current-badge')), findsOneWidget,
        reason: 'the Profile tab must show the current enrolled device');
  });
}
