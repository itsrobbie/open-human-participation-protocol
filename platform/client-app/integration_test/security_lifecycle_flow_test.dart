import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_attester.dart';
import 'support/ohpp_lifecycle_driver.dart';

/// Security lifecycle whole-case (production-lifecycle plan, Phase 2.4), against
/// the real dev stack. Proves the security actions a user drives after signing
/// up and the invariant that each must preserve: participation keeps working.
///
///   1. sign up in-app (real resolver register + post-auth enrollment)
///   2. ROTATE the device key, then answer a request -> the rotated key still
///      signs a valid attestation the resolver accepts (P5 audit record)
///   3. SIGN OUT (credentials cleared) and SIGN BACK IN -> the device is
///      re-resolved through the production login enrollment path, then answer a
///      second request -> still a valid, audited ceremony on the re-resolved
///      device.
///
/// Scope note: there is no GLOBAL "require biometric" toggle in the app -- the
/// auth level that governs the answer path is per-RULE (rule-auth-level), and
/// that mechanism is proven in the 2.3 rules whole-case. So 2.4 covers the two
/// security actions that actually exist as wired features (key rotation and
/// sign-out/sign-in device re-resolution), each guarded by a real audited
/// ceremony rather than asserting a non-existent global toggle.
///
/// Run on a wired device:
///   make flutter-e2e-device FLUTTER_E2E_TESTS=security_lifecycle_flow_test
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  testWidgets(
      'rotate key -> still participates -> sign out -> sign in -> still participates',
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

    // --- Arrange: a brand-new user signs up in-app. ---
    final unique = DateTime.now().millisecondsSinceEpoch;
    final username = 'e2e_sec_$unique';
    final password = 'Pw-$unique!';
    await driver.registerViaApp(username, '$username@example.com', password);
    final identity = await getAccessTokenFor(username, password);
    expect(identity, isNotNull,
        reason: 'the in-app-created account must authenticate against the realm');

    // --- Act 1: rotate the device signing key through the security screen. ---
    await driver.rotateKey();
    await driver.gotoTab('pending');

    // --- Assert 1: the ROTATED key still produces a ceremony the resolver
    // accepts -- rotation must not break signing. ---
    final req1 = await raiseLabRequest(identityToken: identity!);
    expect(req1, isNotNull);
    await driver.refreshUntilCard(req1!);
    await attester.answerStep(req1, const SelectStep('approve'));
    await _expectAuditResolved(identity, req1);

    // --- Act 2: sign out, then sign back in -> device re-resolved through the
    // production login enrollment path. ---
    await driver.signOut();
    await driver.uiLogin(username, password);

    // --- Assert 2: the RE-RESOLVED device still participates end to end. ---
    await driver.gotoTab('pending');
    final req2 = await raiseLabRequest(identityToken: identity);
    expect(req2, isNotNull);
    await driver.refreshUntilCard(req2!);
    await attester.answerStep(req2, const SelectStep('approve'));
    await _expectAuditResolved(identity, req2);
  });
}

/// Poll the proof record (P5 audit by construction) until the ceremony resolves
/// with a signed attestation, or fail.
Future<void> _expectAuditResolved(String identityToken, String requestId) async {
  Map<String, dynamic>? record;
  final deadline = DateTime.now().add(const Duration(seconds: 20));
  while (DateTime.now().isBefore(deadline)) {
    record = await fetchParticipationHistoryDetail(
      identityToken: identityToken,
      requestId: requestId,
    );
    if (record != null && record['resolvedAt'] != null) break;
    await Future<void>.delayed(const Duration(seconds: 1));
  }
  expect(record, isNotNull,
      reason: 'GET /api/history/$requestId should return the audit record');
  expect(record!['resolvedAt'], isNotNull,
      reason: 'the ceremony must resolve on the (rotated/re-resolved) device');
  expect(record['attestationPayload'], isNotNull,
      reason: 'the proof must carry the signed attestation');
}
