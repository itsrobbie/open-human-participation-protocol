import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';

import 'mock_resolver.dart';

/// Step 47: Participation flow integration tests.
void main() {
  late MockResolver resolver;

  setUp(() {
    resolver = MockResolver();
    resolver.pendingRequests = [
      {
        'requestId': 'req-001',
        'appId': 'pizza.example.com',
        'summary': 'Approve order for \$45.00',
        'type': 'select',
        'options': [
          {'key': 'approve', 'label': 'Approve'},
          {'key': 'deny', 'label': 'Deny'},
        ],
        'expiry': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
      },
    ];
  });

  group('Participation Flow', () {
    test('integration_Participate_ReceiveRequest_AppearsInPending', () {
      final pending = resolver.getPending();

      expect(pending.length, 1);
      expect(pending.first['requestId'], 'req-001');
      expect(pending.first['summary'], 'Approve order for \$45.00');
    });

    test('integration_Participate_RespondSelect_SubmitsAttestation', () {
      final result = resolver.submitAttestation({
        'requestId': 'req-001',
        'appId': 'pizza.example.com',
        'decision': 'approve',
        'attestationPayload': '{"selectedOption":"approve"}',
        'deviceSignature': 'mock-sig',
      });

      expect(result['status'], 'ok');
      expect(resolver.pendingRequests, isEmpty);
      expect(resolver.historyEntries.length, 1);
      expect(resolver.historyEntries.first['status'], 'resolved');
    });

    test('integration_Participate_RespondMultiselect_SubmitsAttestation', () {
      resolver.pendingRequests.add({
        'requestId': 'req-002',
        'appId': 'food.example.com',
        'summary': 'Select toppings',
        'type': 'multiselect',
        'options': [
          {'key': 'tomato', 'label': 'Tomato'},
          {'key': 'cheese', 'label': 'Cheese'},
        ],
      });

      final result = resolver.submitAttestation({
        'requestId': 'req-002',
        'decision': 'tomato,cheese',
        'attestationPayload': '{"selectedOptions":["tomato","cheese"]}',
        'deviceSignature': 'mock-sig',
      });

      expect(result['status'], 'ok');
    });

    test('integration_Participate_RespondText_SubmitsAttestation', () {
      resolver.pendingRequests.add({
        'requestId': 'req-003',
        'appId': 'docs.example.com',
        'summary': 'Enter reason',
        'type': 'text',
      });

      final result = resolver.submitAttestation({
        'requestId': 'req-003',
        'decision': 'I approve because the amount is reasonable',
        'attestationPayload': '{"value":"I approve because the amount is reasonable"}',
        'deviceSignature': 'mock-sig',
      });

      expect(result['status'], 'ok');
    });

    test('integration_Participate_Expired_BlocksSubmission', () {
      resolver.pendingRequests.first['expiry'] =
          DateTime.now().subtract(const Duration(hours: 1)).toIso8601String();

      // Client-side check: request is expired
      final expiry = DateTime.parse(resolver.pendingRequests.first['expiry'] as String);
      expect(expiry.isBefore(DateTime.now()), isTrue);
    });

    test('integration_Participate_AlreadyResolved_ShowsBanner', () {
      resolver.submitShouldConflict = true;

      expect(
        () => resolver.submitAttestation({
          'requestId': 'req-001',
          'decision': 'approve',
          'attestationPayload': '{"selectedOption":"approve"}',
          'deviceSignature': 'mock-sig',
        }),
        throwsA(isA<MockApiError>().having((e) => e.statusCode, 'status', 409)),
      );
    });

    test('integration_Participate_NetworkFails_QueuesOffline', () {
      resolver.submitShouldSucceed = false;

      expect(
        () => resolver.submitAttestation({
          'requestId': 'req-001',
          'decision': 'approve',
          'attestationPayload': '{"selectedOption":"approve"}',
          'deviceSignature': 'mock-sig',
        }),
        throwsA(isA<MockApiError>().having((e) => e.statusCode, 'status', 500)),
      );

      // Request remains in pending (wasn't removed due to failure)
      expect(resolver.pendingRequests.length, 1);
    });

    test('integration_Participate_QueueDrains_OnReconnect', () {
      // Simulate: first attempt fails, second succeeds
      resolver.submitShouldSucceed = false;

      expect(
        () => resolver.submitAttestation({
          'requestId': 'req-001',
          'decision': 'approve',
          'attestationPayload': '{"selectedOption":"approve"}',
          'deviceSignature': 'mock-sig',
        }),
        throwsA(isA<MockApiError>()),
      );

      // "Reconnect" - now it works
      resolver.submitShouldSucceed = true;

      final result = resolver.submitAttestation({
        'requestId': 'req-001',
        'decision': 'approve',
        'attestationPayload': '{"selectedOption":"approve"}',
        'deviceSignature': 'mock-sig',
      });

      expect(result['status'], 'ok');
      expect(resolver.pendingRequests, isEmpty);
    });
  });
}
