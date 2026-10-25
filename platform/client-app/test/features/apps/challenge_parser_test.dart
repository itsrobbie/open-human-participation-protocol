import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/apps/challenge_parser.dart';

void main() {
  late ChallengeParser parser;

  setUp(() {
    parser = ChallengeParser();
  });

  String makeValidChallenge({
    String appId = 'pizza.example.com',
    String id = 'challenge-123',
    DateTime? expiry,
  }) {
    final exp = expiry ?? DateTime.now().toUtc().add(const Duration(minutes: 10));
    final json = jsonEncode({
      'appId': appId,
      'id': id,
      'expiry': exp.toIso8601String(),
    });
    return base64Url.encode(utf8.encode(json));
  }

  String makeFullUri(String challenge) => 'ohpp://register?challenge=$challenge';

  /// The CANONICAL RegistrationChallenge wire shape the SDK's ChallengeGenerator
  /// and the resolver actually emit: challengeId / requesterAppId / expiresAt
  /// (camelCase of the C# model). The parser must read THIS, not the legacy
  /// appId / id / expiry shape (regression guard for the connect-never-parsed bug).
  String makeCanonicalChallenge({
    String requesterAppId = 'protocol-lab.dev.test',
    String challengeId = 'abc123',
    DateTime? expiresAt,
  }) {
    final exp =
        expiresAt ?? DateTime.now().toUtc().add(const Duration(minutes: 5));
    final json = jsonEncode({
      'challengeId': challengeId,
      'requesterAppId': requesterAppId,
      'expiresAt': exp.toIso8601String(),
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    return base64Url.encode(utf8.encode(json));
  }

  // --- Happy path ---

  group('Valid parsing', () {
    test('parse_CanonicalWireShape_ReturnsChallenge', () {
      // The real on-the-wire challenge (challengeId/requesterAppId/expiresAt).
      final challenge = makeCanonicalChallenge();

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue,
          reason: 'the parser must accept the canonical RegistrationChallenge shape');
      expect(result.challenge!.appId, equals('protocol-lab.dev.test'));
      expect(result.challenge!.id, equals('abc123'));
    });

    test('parse_CanonicalWireShape_FullUri_ReturnsChallenge', () {
      final uri = makeFullUri(makeCanonicalChallenge());

      final result = parser.parse(uri);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, equals('protocol-lab.dev.test'));
    });

    test('parse_ValidBase64url_ReturnsChallenge', () {
      final challenge = makeValidChallenge();

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, equals('pizza.example.com'));
      expect(result.challenge!.id, equals('challenge-123'));
    });

    test('parse_ValidFullUri_ExtractsChallengeParam', () {
      final challenge = makeValidChallenge();
      final uri = makeFullUri(challenge);

      final result = parser.parse(uri);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, equals('pizza.example.com'));
    });

    test('parse_ValidChallenge_AllFieldsPopulated', () {
      final expiry = DateTime.now().toUtc().add(const Duration(hours: 1));
      final challenge = makeValidChallenge(
        appId: 'bank.example.com',
        id: 'ch-456',
        expiry: expiry,
      );

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, equals('bank.example.com'));
      expect(result.challenge!.id, equals('ch-456'));
      expect(result.challenge!.expiry.isAfter(DateTime.now()), isTrue);
    });

    test('parse_FutureExpiry_Accepted', () {
      final challenge = makeValidChallenge(
        expiry: DateTime.now().toUtc().add(const Duration(days: 1)),
      );

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue);
    });

    test('parse_DomainAppId_Accepted', () {
      final challenge = makeValidChallenge(appId: 'sub.domain.example.com');

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue);
      expect(result.challenge!.appId, equals('sub.domain.example.com'));
    });

    test('parse_DotTestTLD_Accepted', () {
      final challenge = makeValidChallenge(appId: 'myapp.test');

      final result = parser.parse(challenge);

      expect(result.isSuccess, isTrue);
    });
  });

  // --- Non-happy path ---

  group('Invalid parsing', () {
    test('parse_ExpiredChallenge_ReturnsExpiredError', () {
      final challenge = makeValidChallenge(
        expiry: DateTime.now().toUtc().subtract(const Duration(minutes: 5)),
      );

      final result = parser.parse(challenge);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.expired));
    });

    test('parse_MissingAppId_ReturnsInvalidError', () {
      final json = jsonEncode({'id': 'ch-1', 'expiry': DateTime.now().toUtc().add(const Duration(hours: 1)).toIso8601String()});
      final encoded = base64Url.encode(utf8.encode(json));

      final result = parser.parse(encoded);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.invalid));
    });

    test('parse_MissingId_ReturnsInvalidError', () {
      final json = jsonEncode({'appId': 'app.test', 'expiry': DateTime.now().toUtc().add(const Duration(hours: 1)).toIso8601String()});
      final encoded = base64Url.encode(utf8.encode(json));

      final result = parser.parse(encoded);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.invalid));
    });

    test('parse_MissingExpiry_ReturnsInvalidError', () {
      final json = jsonEncode({'appId': 'app.test', 'id': 'ch-1'});
      final encoded = base64Url.encode(utf8.encode(json));

      final result = parser.parse(encoded);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.invalid));
    });

    test('parse_InvalidBase64_ReturnsFormatError', () {
      final result = parser.parse('not-valid-base64!!!');

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.format));
    });

    test('parse_MalformedJson_ReturnsFormatError', () {
      final encoded = base64Url.encode(utf8.encode('not json at all'));

      final result = parser.parse(encoded);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.format));
    });

    test('parse_InvalidAppIdFormat_ReturnsInvalidError', () {
      final json = jsonEncode({
        'appId': 'not a domain',
        'id': 'ch-1',
        'expiry': DateTime.now().toUtc().add(const Duration(hours: 1)).toIso8601String(),
      });
      final encoded = base64Url.encode(utf8.encode(json));

      final result = parser.parse(encoded);

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.invalid));
    });

    test('parse_EmptyString_ReturnsFormatError', () {
      final result = parser.parse('');

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.format));
    });

    test('parse_UriWithoutChallengeParam_ReturnsInvalidError', () {
      final result = parser.parse('ohpp://register?other=value');

      expect(result.isSuccess, isFalse);
      expect(result.error, equals(ChallengeError.invalid));
    });
  });
}
