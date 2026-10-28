import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';

/// Full-flow end-to-end test for the core OHPP journey, against the real dev
/// stack (make dev):
///
///   1. A transfer is created on the Bank, which triggers a participation
///      request for the demo user.
///   2. The request shows up in the app's Pending list with the correct
///      human-readable details.
///   3. The request is actioned (approved) in the app. The app's real
///      AttestationService runs in test-mode anti-agent: the software ES256
///      signer produces a genuine signature and the auto-approve biometric
///      stands in for Face ID. The signature verifies server-side because the
///      harness registered the matching public key.
///   4. The app shows the request resolved (success SnackBar + it leaves the
///      pending list), and the Bank reports the transfer Completed.
///
/// The app is started ALREADY SIGNED IN via the shared harness, so this test
/// does not re-drive the UI login (that is covered once by auth_test.dart).
///
/// Precondition: the demo Bank account (`demo-account`) must be OHPP-connected
/// in the running stack (make dev seeds it connected). If not, the transfer is
/// not PendingApproval and the test fails with a clear message.
///
/// Run on a simulator against the dev stack: `make flutter-test-e2e`.
const e2eBankUrl =
    String.fromEnvironment('E2E_BANK_URL', defaultValue: 'http://localhost:5010');

/// The Bank authenticates against its own Keycloak realm/client (distinct from
/// the app/portal realm the client uses).
const e2eBankRealm = 'ohpp-bank';
const e2eBankClientId = 'ohpp-bank-app';

/// Seeded demo data in the dev stack.
const e2eBankAccountId = 'demo-account';
const e2eBankPayeeId = 'payee-landlord';
const e2eBankPayeeName = 'Landlord - J. Smith';

/// Obtain a Bank access token (ohpp-bank realm) for the demo user.
Future<String?> getBankToken() async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse(
        '$e2eKeycloakUrl/realms/$e2eBankRealm/protocol/openid-connect/token'));
    request.headers.contentType =
        ContentType('application', 'x-www-form-urlencoded');
    request.write(Uri(queryParameters: {
      'grant_type': 'password',
      'client_id': e2eBankClientId,
      'username': e2eTestUsername,
      'password': e2eTestPassword,
    }).query);
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    if (response.statusCode != 200) return null;
    return (jsonDecode(body) as Map<String, dynamic>)['access_token'] as String?;
  } finally {
    client.close();
  }
}

/// Create a Bank transfer that requires OHPP participation. Returns the parsed
/// TransferResult JSON ({ success, status, participationRequestId, error }).
Future<Map<String, dynamic>?> createBankTransfer({
  required String bankToken,
  required double amount,
  required String reference,
}) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2eBankUrl/api/transfers'));
    request.headers.set('Authorization', 'Bearer $bankToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'fromAccountId': e2eBankAccountId,
      'toPayeeId': e2eBankPayeeId,
      'amount': amount,
      'reference': reference,
    }));
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    if (body.isEmpty) return null;
    return jsonDecode(body) as Map<String, dynamic>;
  } finally {
    client.close();
  }
}

/// Poll the Bank for the transfer's status until terminal or timeout.
Future<String?> pollBankTransferStatus({
  required String bankToken,
  required String participationRequestId,
  Duration timeout = const Duration(seconds: 30),
}) async {
  final client = HttpClient();
  final end = DateTime.now().add(timeout);
  try {
    String? last;
    while (DateTime.now().isBefore(end)) {
      final request = await client.getUrl(Uri.parse(
          '$e2eBankUrl/api/transfers/$participationRequestId/status?accountId=$e2eBankAccountId'));
      request.headers.set('Authorization', 'Bearer $bankToken');
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode == 200 && body.isNotEmpty) {
        last = (jsonDecode(body) as Map<String, dynamic>)['status'] as String?;
        if (last == 'Completed' ||
            last == 'Denied' ||
            last == 'Expired' ||
            last == 'Failed') {
          return last;
        }
      }
      await Future<void>.delayed(const Duration(seconds: 1));
    }
    return last;
  } finally {
    client.close();
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  Future<void> pumpUntilFound(
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

  Future<void> pumpUntilGone(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 500));
      if (finder.evaluate().isEmpty) return;
    }
    await tester.pumpAndSettle();
  }

  testWidgets(
      'transfer -> shows in app -> approve in app -> resolved on both sides',
      (tester) async {
    // --- Arrange: signed-in app + a registered device with a published key. ---
    final identityToken = await getAccessToken();
    expect(identityToken, isNotNull,
        reason: 'demo user should authenticate against Keycloak');
    final device = await setupDevice(identityToken!);
    expect(device, isNotNull, reason: 'device registration should succeed');

    final harness = E2EHarness.create(deviceToken: device!.deviceToken);
    // Publish the harness signer's public key so the resolver can verify the
    // attestation signature the app will produce on approve.
    await harness.registerDeviceKey();

    final bankToken = await getBankToken();
    expect(bankToken, isNotNull,
        reason: 'demo user should authenticate against the Bank realm');

    // --- Act 1: create a transfer on the Bank that needs approval. ---
    // Unique amount so this run's request is identifiable among any leftovers.
    final unique = DateTime.now().millisecondsSinceEpoch;
    final amount = 100 + (unique % 9000) / 100.0;
    final transfer = await createBankTransfer(
      bankToken: bankToken!,
      amount: amount,
      reference: 'E2E approval $unique',
    );
    expect(transfer, isNotNull, reason: 'transfer POST should return a body');

    final status = transfer!['status'] as String?;
    final requestId = transfer['participationRequestId'] as String?;
    expect(status, 'PendingApproval',
        reason: 'demo-account must be OHPP-connected so the transfer creates a '
            'participation request. Got status=$status '
            '(error=${transfer['error']}).');
    expect(requestId, isNotNull);

    // --- Act 2: open the app (already signed in) and wait for the request. ---
    await tester.pumpWidget(harness.buildAppSignedIn(
      identityToken: identityToken,
      deviceToken: device.deviceToken,
    ));
    await tester.pumpAndSettle();

    final expectedSummary =
        'Transfer £${amount.toStringAsFixed(2)} to $e2eBankPayeeName';
    await pumpUntilFound(tester, find.text(expectedSummary),
        timeout: const Duration(seconds: 30));
    expect(find.byKey(const Key('pending-list')), findsOneWidget,
        reason: 'the pending list should render');
    expect(find.text(expectedSummary), findsWidgets,
        reason: 'the seeded request should render with the bank summary');

    // --- Act 3: open the detail sheet and approve. ---
    final ourCard = find.ancestor(
      of: find.text(expectedSummary),
      matching: find.byType(InkWell),
    );
    await tester.tap(ourCard.first);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('detail-header')), findsOneWidget);

    final approveChip = find.byKey(const Key('select-chip-approve'));
    expect(approveChip, findsOneWidget,
        reason: 'bank transfer request should offer an approve option');
    await tester.tap(approveChip);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('detail-submit')));

    // Poll for a SnackBar so a failed submit surfaces its message.
    final successText = find.text('Response submitted');
    String? snackText;
    final deadline = DateTime.now().add(const Duration(seconds: 25));
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 500));
      if (successText.evaluate().isNotEmpty) break;
      final snack = find.byType(SnackBar);
      if (snack.evaluate().isNotEmpty) {
        final texts = find.descendant(of: snack, matching: find.byType(Text));
        if (texts.evaluate().isNotEmpty) {
          snackText = (texts.evaluate().first.widget as Text).data;
          if (snackText != 'Response submitted') break;
        }
      }
    }

    // --- Assert: app shows success and drops the request from pending. ---
    expect(successText, findsWidgets,
        reason: 'a successful approve shows the "Response submitted" SnackBar. '
            'Instead the app showed: ${snackText ?? '(no SnackBar)'}');
    await pumpUntilGone(tester, find.text(expectedSummary),
        timeout: const Duration(seconds: 20));
    expect(find.text(expectedSummary), findsNothing,
        reason: 'after approval the resolved request should leave pending');

    // --- Assert: the Bank sees the transfer Completed. ---
    final bankStatus = await pollBankTransferStatus(
      bankToken: bankToken,
      participationRequestId: requestId!,
      timeout: const Duration(seconds: 30),
    );
    expect(bankStatus, 'Completed',
        reason: 'once the app approves, the bank status should resolve to Completed');

    // --- Assert: the Resolver recorded an auditable human-participation proof. ---
    // The whole point of OHPP: not just that the bank completed, but that a
    // verifiable record of a human's signed decision exists. Poll briefly since
    // the record is written as the resolution is persisted.
    Map<String, dynamic>? record;
    final auditDeadline = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(auditDeadline)) {
      record = await fetchParticipationHistoryDetail(
        identityToken: identityToken,
        requestId: requestId,
      );
      if (record != null && record['resolvedAt'] != null) break;
      await Future<void>.delayed(const Duration(seconds: 1));
    }
    expect(record, isNotNull,
        reason: 'GET /api/history/$requestId should return the audit record '
            'after the ceremony resolves');
    expect(record!['requestId']?.toString().toLowerCase(),
        requestId.toLowerCase(),
        reason: 'the audit record must be for this ceremony');
    expect(record['resolvedAt'], isNotNull,
        reason: 'a resolved ceremony must stamp resolvedAt');
    expect(record['resolvingDeviceId'], isNotNull,
        reason: 'the proof must name the device that produced the attestation');
    expect(record['attestationPayload'], isNotNull,
        reason: 'the proof must carry the signed attestation payload -- the '
            'cryptographic evidence a human participated');
  });
}
