import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'e2e_app_harness.dart';
import 'e2e_helpers.dart';
import 'support/ohpp_attester.dart';

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

      // --- Act 3: drive each of the 7 steps through the SHARED OhppAttester
      // driver (P3: one driver per role; 4.2: no bespoke modal mechanics in the
      // test). Each step is addressed by its real OHPP request id — step 1's id
      // comes from startFlow, each later step's from the prior /advance — so the
      // keyed card Key('ohpp.pending.card.<requestId>') is unambiguous even as
      // the list reorders. Between steps we force a pending-list refresh (the
      // harness has no live SSE/poll), then let the driver wait for the fresh
      // keyed card deterministically.
      final attester = OhppAttester(tester);
      // The per-step answer, matching ohpp-pizza-flow-controller.ts step order:
      //   1 select base, 2 select size, 3 multiselect toppings, 4 text,
      //   5 date, 6 number tip, 7 select confirm.
      OhppStep stepAnswerFor(int step) => switch (step) {
            1 => const SelectStep('margherita'),
            2 => const SelectStep('small'),
            3 => const MultiselectStep(['none']),
            4 => const TextStep('e2e'),
            5 => const DateStep(),
            6 => const NumberStep('0'),
            _ => const SelectStep('confirm'),
          };

      String? requestId = flow['activeRequestId'] as String?;
      String? lastRequestId;
      for (var step = 1; step <= totalSteps; step++) {
        expect(requestId, isNotNull,
            reason: 'step $step should have an active OHPP request id from the '
                'requester (startFlow for step 1, /advance thereafter)');
        lastRequestId = requestId;

        // Force the pending list to re-fetch so this step's just-sent request
        // renders. In production the list stays live via SSE + a foreground
        // poller started on AppLifecycleState.resumed; a headless integration
        // test never emits that lifecycle event, so the poller never starts and
        // the list goes stale after step 1. Drive the REAL production refresh
        // path by emitting a resumed lifecycle transition (which runs
        // AppLifecycleManager._onAppResumed -> pendingProvider.refresh()), then
        // poll-until THIS request's keyed card appears.
        final cardKey = 'ohpp.pending.card.$requestId';
        final cardEnd = DateTime.now().add(const Duration(seconds: 40));
        var appeared = false;
        while (DateTime.now().isBefore(cardEnd)) {
          if (find.byKey(Key(cardKey)).evaluate().isNotEmpty) {
            appeared = true;
            break;
          }
          tester.binding
              .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));
          await tester.pumpAndSettle(const Duration(milliseconds: 700));
        }
        if (!appeared) {
          // The flow may already be complete (step 7 ends it) — if so, stop.
          final st = await pizzaGet(pizzaToken, '/api/orders/ohpp-pizza/status');
          final flowStatusNow = (st?['flow'] as Map<String, dynamic>?)?['status'];
          if (flowStatusNow == null || flowStatusNow == 'completed') break;
          fail('step $step: card $cardKey never appeared within 40s '
              '(flow status=$flowStatusNow). Inter-step propagation gap?');
        }

        // Drive the keyed card -> detail sheet -> keyed answer -> submit.
        await attester.answerStep(requestId!, stepAnswerFor(step));

        // answerStep returns right after the submit tap; the detail sheet is a
        // modal bottom sheet the screen owns, so dismiss it if it is still open
        // so the next step's card is reachable (a lingering sheet would sit over
        // the pending list and the next fling/lookup would miss).
        await tester.pumpAndSettle(const Duration(seconds: 2));
        if (find.byKey(const Key('detail-header')).evaluate().isNotEmpty) {
          await tester.pageBack();
          await tester.pumpAndSettle();
        }

        // Poll the requester's /advance until the flow leaves this step (the
        // next request is sent) or the flow terminates; capture the next id.
        Map<String, dynamic>? adv;
        String? nextRequestId;
        final advEnd = DateTime.now().add(const Duration(seconds: 25));
        while (DateTime.now().isBefore(advEnd)) {
          adv = await pizzaPost(
              pizzaToken, '/api/orders/ohpp-pizza/$flowId/advance');
          final advFlow = adv?['flow'] as Map<String, dynamic>?;
          final curStep = (advFlow?['currentStep'] as num?)?.toInt();
          final status = advFlow?['status'] as String?;
          nextRequestId = advFlow?['activeRequestId'] as String?;
          if (status != 'in_progress' ||
              (curStep != null && curStep > step && nextRequestId != null)) {
            break;
          }
          await Future<void>.delayed(const Duration(seconds: 1));
        }
        requestId = nextRequestId;
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
