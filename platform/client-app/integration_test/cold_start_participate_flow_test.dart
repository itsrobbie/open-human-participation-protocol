import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_attester.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// Cold-start -> participate whole-case (production-lifecycle plan, Phase 2.1),
/// against the real dev stack. The headline journey, end to end on real
/// hardware and starting from NOTHING:
///
///   no account -> in-app sign-up (resolver-brokered, IdP hidden) ->
///   authenticated -> device enrolled (Secure-Enclave key published) ->
///   a requester app raises a participation request for THIS new user ->
///   the human answers it IN-APP -> the Resolver records the signed proof.
///
/// This supersedes the old injected-token shortcut for the headline journey:
/// the account and the device key are created through the app's own paths, and
/// the only out-of-band step is the requester raising the request (which a
/// requester app does, not the human).
///
/// Run on a wired device:
///   make flutter-e2e-device FLUTTER_E2E_TESTS=cold_start_participate_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets('cold start: sign up in-app -> enroll -> participate -> audit',
      (tester) async {
    final driver = OhppLifecycleDriver(tester);
    final attester = OhppAttester(tester);

    // Seed a device token for the harness API client; the real enrollment that
    // runs on register re-derives the device from the brokered identity token.
    final seedIdentity = await getAccessToken();
    expect(seedIdentity, isNotNull);
    final seedDevice = await setupDevice(seedIdentity!);
    expect(seedDevice, isNotNull);

    final harness = E2EHarness.create(deviceToken: seedDevice!.deviceToken);
    await tester.pumpWidget(harness.buildAppForAuth(deviceToken: seedDevice.deviceToken));
    await tester.pumpAndSettle();

    // --- Act 1: a brand-new user signs up IN-APP. ---
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_$unique';
    final password = 'Pw-$unique!';
    await driver.registerViaApp(username, '$username@example.com', password);
    expect(find.byKey(const Key('tab-pending')), findsOneWidget,
        reason: 'the new user should land authenticated on Pending');

    // --- Act 2: a requester app raises a participation request for this user. ---
    // Use the Protocol Lab (a dev requester hosted in the Resolver) to raise a
    // request for the new user through the real ceremony — the only out-of-band
    // step, and a requester's job, not the human's.
    final identity = await getAccessTokenFor(username, password);
    expect(identity, isNotNull,
        reason: 'the in-app-created account must authenticate against the realm');
    final requestId = await raiseLabRequest(identityToken: identity!);
    expect(requestId, isNotNull,
        reason: 'the Protocol Lab should raise a request for the new user');

    // --- Act 3: the human answers it IN-APP. ---
    // Poll-refresh the pending list (the harness has no live poll) until this
    // request's keyed card renders, then drive card -> detail -> approve -> submit.
    await driver.refreshUntilCard(requestId!);
    await attester.answerStep(requestId, const SelectStep('approve'));

    // --- Assert: the Resolver recorded an auditable human-participation proof
    // (P5) for the new user's very first ceremony. ---
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
    expect(record, isNotNull,
        reason: 'GET /api/history/$requestId should return the audit record');
    expect(record!['resolvedAt'], isNotNull,
        reason: 'a resolved ceremony must stamp resolvedAt');
    expect(record['attestationPayload'], isNotNull,
        reason: 'the proof must carry the signed attestation — a human participated');
  });
}
