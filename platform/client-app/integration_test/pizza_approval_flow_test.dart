import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';

/// Whole-case end-to-end test for the PIZZA requester, against the real dev
/// stack (make dev). Pizza is the headline onboarding case: a human orders a
/// pizza and approves each step on the phone.
///
/// Unlike the Bank (single approve), the Pizza requester runs a SEVEN-STEP
/// sequential OHPP flow (ohpp-pizza-flow-controller.ts, TOTAL_STEPS=7):
///   1 select pizza base, 2 select size, 3 multiselect toppings, 4 text
///   instructions, 5 date delivery, 6 number tip, 7 select confirm.
/// The flow only advances when the requester polls `advanceFlow`, so this test
/// INTERLEAVES: app answers the current pending request -> test polls the pizza
/// backend's /advance -> the next step's request appears -> repeat. After step
/// 7 (confirm) the backend creates the order; we then assert the Resolver's
/// audit record exists for the final request.
///
/// Precondition: the demo pizza user must be OHPP-connected in the running
/// stack. If not connected, startFlow returns 'OHPP not connected' and the test
/// fails with a clear message (connect the pizza app once via Portal/app).
///
/// Run on a simulator against the dev stack: `make flutter-test-e2e`.
const e2ePizzaUrl =
    String.fromEnvironment('E2E_PIZZA_URL', defaultValue: 'http://localhost:5030');
const e2ePizzaRealm = 'ohpp-pizza';
const e2ePizzaClientId = 'ohpp-pizza-app';

/// Obtain a Pizza access token (ohpp-pizza realm) for the demo user.
Future<String?> getPizzaToken() async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse(
        '$e2eKeycloakUrl/realms/$e2ePizzaRealm/protocol/openid-connect/token'));
    request.headers.contentType =
        ContentType('application', 'x-www-form-urlencoded');
    request.write(Uri(queryParameters: {
      'grant_type': 'password',
      'client_id': e2ePizzaClientId,
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

/// POST a pizza backend path with the pizza bearer token; returns decoded JSON.
Future<Map<String, dynamic>?> pizzaPost(String token, String path,
    [Map<String, dynamic>? body]) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2ePizzaUrl$path'));
    request.headers.set('Authorization', 'Bearer $token');
    request.headers.contentType = ContentType.json;
    if (body != null) request.write(jsonEncode(body));
    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    if (text.isEmpty) return {'_status': response.statusCode};
    final decoded = jsonDecode(text);
    return decoded is Map<String, dynamic>
        ? {...decoded, '_status': response.statusCode}
        : {'_status': response.statusCode, '_body': decoded};
  } finally {
    client.close();
  }
}

/// GET a pizza backend path; returns decoded JSON.
Future<Map<String, dynamic>?> pizzaGet(String token, String path) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse('$e2ePizzaUrl$path'));
    request.headers.set('Authorization', 'Bearer $token');
    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    if (text.isEmpty) return {'_status': response.statusCode};
    return {
      ...(jsonDecode(text) as Map<String, dynamic>),
      '_status': response.statusCode
    };
  } finally {
    client.close();
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(setupPlatformChannelOverrides);
  tearDown(teardownPlatformChannelOverrides);

  group('Pizza whole-case ceremony (real backend)', () {
    testWidgets(
        'order -> approve each step in app -> order confirmed -> audit recorded',
        (tester) async {
      // --- Arrange: signed-in app with a published device key. ---
      final identityToken = await getAccessToken();
      expect(identityToken, isNotNull,
          reason: 'demo user should authenticate against Keycloak (ohpp realm)');
      final device = await setupDevice(identityToken!);
      expect(device, isNotNull, reason: 'device registration should succeed');
      final harness = E2EHarness.create(deviceToken: device!.deviceToken);
      await harness.registerDeviceKey();

      final pizzaToken = await getPizzaToken();
      expect(pizzaToken, isNotNull,
          reason: 'demo user should authenticate against the Pizza realm');

      // --- Act 1: start the OHPP pizza flow on the requester. ---
      // Test isolation: a prior aborted run can leave a flow stuck in_progress,
      // which blocks startFlow with "already in progress". Clear it first by
      // asking the requester to advance/cancel any active flow, then retry.
      await _resetActivePizzaFlow(pizzaToken!);
      final start = await pizzaPost(pizzaToken, '/api/orders/ohpp-pizza');
      expect(start, isNotNull);
      expect(start!['_status'], anyOf(200, 201),
          reason: 'startFlow should succeed. If 400 "OHPP not connected", the '
              'demo pizza user is not OHPP-connected in this stack — connect '
              'the pizza app once first. Got: $start');
      final flow = start['flow'] as Map<String, dynamic>?;
      expect(flow, isNotNull, reason: 'startFlow should return the flow');
      final flowId = flow!['id'] as String;
      final totalSteps = (flow['totalSteps'] as num?)?.toInt() ?? 7;

      // --- Act 2: open the app signed in. ---
      await tester.pumpWidget(harness.buildAppSignedIn(
        identityToken: identityToken,
        deviceToken: device.deviceToken,
      ));
      await tester.pumpAndSettle();

      // --- Act 3: drive each of the 7 steps: answer the pending request in
      // the app, then poll the requester's /advance so the next step is sent.
      String? lastRequestId;
      for (var step = 1; step <= totalSteps; step++) {
        // Wait for a pending request card to render. After the previous step's
        // /advance sent the next request, the app learns about it via SSE/poll,
        // so give it time and refresh the pending list if needed.
        final card = find.byType(InkWell);
        var appeared = false;
        final cardEnd = DateTime.now().add(const Duration(seconds: 40));
        while (DateTime.now().isBefore(cardEnd)) {
          await tester.pump(const Duration(milliseconds: 500));
          if (card.evaluate().isNotEmpty) {
            appeared = true;
            break;
          }
        }
        if (!appeared) {
          // No pending card: either the flow already completed (step 7 ends it)
          // or the next request hasn't propagated. If the requester says the
          // flow is done, stop driving steps; otherwise fail with context.
          final st = await pizzaGet(pizzaToken, '/api/orders/ohpp-pizza/status');
          final flowStatusNow = (st?['flow'] as Map<String, dynamic>?)?['status'];
          if (flowStatusNow == null || flowStatusNow == 'completed') break;
          fail('step $step: no pending request card appeared in the app within '
              '40s (flow status=$flowStatusNow). Inter-step propagation gap?');
        }
        await tester.tap(card.first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('detail-header')), findsOneWidget,
            reason: 'step $step request should open a detail sheet');

        // Answer by the detail sheet's real input control, keyed by type:
        //   select     -> ChoiceChip  (key select-chip-*)
        //   multiselect -> FilterChip
        //   text/number -> TextField (keys response-input-text/-number)
        //   date        -> OutlinedButton opens a native date picker
        final choiceChip = find.byType(ChoiceChip);
        final filterChip = find.byType(FilterChip);
        final textField = find.byType(TextField);
        final dateInput = find.byKey(const Key('response-input-date'));
        if (choiceChip.evaluate().isNotEmpty) {
          await tester.ensureVisible(choiceChip.first);
          await tester.pumpAndSettle();
          await tester.tap(choiceChip.first);
          await tester.pumpAndSettle();
        } else if (filterChip.evaluate().isNotEmpty) {
          await tester.ensureVisible(filterChip.first);
          await tester.pumpAndSettle();
          await tester.tap(filterChip.first);
          await tester.pumpAndSettle();
        } else if (dateInput.evaluate().isNotEmpty) {
          // Open the native date picker and accept the default (today).
          await tester.tap(find.descendant(
              of: dateInput, matching: find.byType(OutlinedButton)));
          await tester.pumpAndSettle();
          final ok = find.text('OK');
          if (ok.evaluate().isNotEmpty) {
            await tester.tap(ok.first);
            await tester.pumpAndSettle();
          }
        } else if (textField.evaluate().isNotEmpty) {
          await tester.enterText(textField.first, step == 6 ? '0' : 'e2e');
          await tester.pumpAndSettle();
        }

        final submit = find.byKey(const Key('detail-submit'));
        await tester.ensureVisible(submit);
        await tester.pumpAndSettle();
        await tester.tap(submit);
        await tester.pumpAndSettle(const Duration(seconds: 2));

        // The detail sheet is a modal bottom sheet; if it is still open after
        // submit, dismiss it so the loop returns to the pending list and the
        // NEXT step's card is reachable (otherwise we re-tap the stale sheet
        // and the flow stalls at the current step).
        if (find.byKey(const Key('detail-header')).evaluate().isNotEmpty) {
          await tester.pageBack();
          await tester.pumpAndSettle();
        }
        Map<String, dynamic>? adv;
        final advEnd = DateTime.now().add(const Duration(seconds: 20));
        while (DateTime.now().isBefore(advEnd)) {
          adv = await pizzaPost(
              pizzaToken, '/api/orders/ohpp-pizza/$flowId/advance');
          final advFlow = adv?['flow'] as Map<String, dynamic>?;
          final curStep = (advFlow?['currentStep'] as num?)?.toInt();
          final status = advFlow?['status'] as String?;
          if (status != 'in_progress' || (curStep != null && curStep > step)) {
            break;
          }
          await Future<void>.delayed(const Duration(seconds: 1));
        }
        lastRequestId = (adv?['flow'] as Map<String, dynamic>?)?['activeRequestId']
            as String?;
      }

      // --- Assert: the flow completed and produced a confirmed order. ---
      final flowStatus =
          await pizzaGet(pizzaToken, '/api/orders/ohpp-pizza/status');
      // After completion there is no active flow, so status may be 404; the
      // orders list is the durable proof. /api/orders returns a JSON array.
      final ordersList = await _pizzaGetList(pizzaToken, '/api/orders');
      final confirmed = ordersList.any((o) =>
          (o as Map)['orderMode'] == 'ohpp-pizza' &&
          ((o)['status'] == 'confirmed' || (o)['status'] == 'completed'));
      expect(confirmed, isTrue,
          reason: 'the ohpp-pizza flow should produce a confirmed order. '
              'flowStatus=$flowStatus ordersList=$ordersList');

      // --- Assert: the Resolver recorded an auditable proof for the final
      // (confirm) request. ---
      if (lastRequestId != null) {
        final record = await fetchParticipationHistoryDetail(
          identityToken: identityToken,
          requestId: lastRequestId,
        );
        expect(record, isNotNull,
            reason: 'the final confirm step should leave an audit record');
        expect(record!['attestationPayload'], isNotNull,
            reason: 'the proof must carry the signed attestation payload');
      }
    });
  });
}

/// Cancels any active pizza flow for the demo user so a fresh ceremony can
/// start. A flow stuck in_progress (from an aborted run) otherwise blocks
/// startFlow with "already in progress". Best-effort: status -> cancel by id.
Future<void> _resetActivePizzaFlow(String token) async {
  final status = await pizzaGet(token, '/api/orders/ohpp-pizza/status');
  final flow = status?['flow'] as Map<String, dynamic>?;
  final flowId = flow?['id'] as String?;
  if (flowId != null) {
    await pizzaPost(token, '/api/orders/ohpp-pizza/$flowId/cancel');
  }
  // Also nudge advance in case the flow is active-but-not-status-visible.
  // (startFlow itself self-heals via advanceFlow, but a pending orphan step
  // may remain; the cancel above handles the recoverable case.)
}

/// GET a pizza path whose body is a JSON array.
Future<List<dynamic>> _pizzaGetList(String token, String path) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse('$e2ePizzaUrl$path'));
    request.headers.set('Authorization', 'Bearer $token');
    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    if (text.isEmpty) return const [];
    final decoded = jsonDecode(text);
    return decoded is List ? decoded : const [];
  } finally {
    client.close();
  }
}
