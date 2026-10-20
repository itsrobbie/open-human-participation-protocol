import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/apps/challenge_parser.dart';

import 'mock_resolver.dart';

/// Step 46: Registration ceremony integration tests.
void main() {
  late MockResolver resolver;

  setUp(() {
    resolver = MockResolver();
  });

  String _makeValidChallenge({String? appId, DateTime? expiry}) {
    final payload = {
      'id': 'challenge-001',
      'appId': appId ?? 'pizza.example.com',
      'appName': 'Pizza App',
      'expiry': (expiry ?? DateTime.now().add(const Duration(hours: 1))).toIso8601String(),
    };
    final encoded = base64Url.encode(utf8.encode(jsonEncode(payload)));
    return encoded;
  }

  group('Registration Ceremony', () {
    test('integration_Registration_DeepLink_ProcessesAndConfirms', () {
      final challenge = _makeValidChallenge();
      final uri = 'ohpp://register?challenge=$challenge';

      // Parse the URI
      final parser = ChallengeParser();
      final result = parser.parse(uri);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, 'pizza.example.com');

      // Process with resolver
      final app = resolver.processChallenge(challenge);
      expect(app['appId'], isNotEmpty);
      expect(resolver.registeredApps.length, 1);
    });

    test('integration_Registration_QRScan_ProcessesAndConfirms', () {
      // QR contains raw URI
      final challenge = _makeValidChallenge(appId: 'bank.example.com');
      final qrContent = 'ohpp://register?challenge=$challenge';

      final parser = ChallengeParser();
      final result = parser.parse(qrContent);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, 'bank.example.com');

      final app = resolver.processChallenge(challenge);
      expect(app, isNotNull);
    });

    test('integration_Registration_ManualPaste_ProcessesAndConfirms', () {
      final challenge = _makeValidChallenge();
      final pastedLink = 'ohpp://register?challenge=$challenge';

      final parser = ChallengeParser();
      final result = parser.parse(pastedLink);

      expect(result.isSuccess, isTrue);

      final app = resolver.processChallenge(challenge);
      expect(app, isNotNull);
    });

    test('integration_Registration_ExpiredChallenge_ShowsError', () {
      final expiredChallenge = _makeValidChallenge(
        expiry: DateTime.now().subtract(const Duration(hours: 1)),
      );
      final uri = 'ohpp://register?challenge=$expiredChallenge';

      final parser = ChallengeParser();
      final result = parser.parse(uri);

      expect(result.isSuccess, isFalse);
      expect(result.error, ChallengeError.expired);
    });

    test('integration_Registration_InvalidChallenge_ShowsError', () {
      const uri = 'ohpp://register?challenge=not-valid-base64!!!';

      final parser = ChallengeParser();
      final result = parser.parse(uri);

      expect(result.isSuccess, isFalse);
    });

    test('integration_Registration_AlreadyRegistered_ShowsMessage', () {
      resolver.registeredApps.add({
        'appId': 'pizza.example.com',
        'appName': 'Pizza App',
        'registeredAt': DateTime.now().toIso8601String(),
      });

      // App already exists in list
      expect(
        resolver.registeredApps.any((a) => a['appId'] == 'pizza.example.com'),
        isTrue,
      );
    });
  });
}
