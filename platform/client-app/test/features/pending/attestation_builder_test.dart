import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';
import 'package:ohpp_client/shared/models/models.dart';

void main() {
  late AttestationBuilder builder;
  late _FakeCryptoService fakeCrypto;

  setUp(() {
    fakeCrypto = _FakeCryptoService();
    builder = AttestationBuilder(cryptoService: fakeCrypto);
  });

  // --- Happy path ---

  group('Payload construction', () {
    test('build_SelectType_IncludesSelectedOption', () async {
      final decision = const AttestationDecision(selectedOption: 'approve');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.select,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['selectedOption'], equals('approve'));
      expect(payload.containsKey('selectedOptions'), isFalse);
      expect(payload.containsKey('value'), isFalse);
    });

    test('build_MultiselectType_IncludesSelectedOptions', () async {
      final decision = const AttestationDecision(selectedOptions: ['opt1', 'opt2']);

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.multiselect,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['selectedOptions'], equals(['opt1', 'opt2']));
    });

    test('build_TextType_IncludesValue', () async {
      final decision = const AttestationDecision(value: 'my response text');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.text,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['value'], equals('my response text'));
    });

    test('build_NumberType_IncludesNumericValue', () async {
      final decision = const AttestationDecision(value: '42.5');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.number,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['value'], equals('42.5'));
    });

    test('build_DateType_IncludesIsoDate', () async {
      final decision = const AttestationDecision(value: '2026-08-17');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.date,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['value'], equals('2026-08-17'));
    });

    test('build_DatetimeType_IncludesIsoDatetime', () async {
      final decision = const AttestationDecision(value: '2026-08-17T10:30:00Z');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.datetime,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['value'], equals('2026-08-17T10:30:00Z'));
    });

    test('build_SignatureType_IncludesSignatureData', () async {
      final decision = const AttestationDecision(signatureData: 'base64_sig_data');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.signature,
      );

      final payload = jsonDecode(result.attestationPayload) as Map<String, dynamic>;
      expect(payload['signatureData'], equals('base64_sig_data'));
    });
  });

  group('Canonical JSON', () {
    test('build_CanonicalJson_KeysSorted', () async {
      final decision = const AttestationDecision(
        selectedOption: 'approve',
        value: 'extra',
      );

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.select,
      );

      // Verify keys are in alphabetical order in the payload
      final payload = result.attestationPayload;
      final keys = _extractKeyOrder(payload);
      final sorted = List<String>.from(keys)..sort();
      expect(keys, equals(sorted));
    });

    test('build_CanonicalJson_NoWhitespace', () async {
      final decision = const AttestationDecision(selectedOption: 'approve');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.select,
      );

      // No spaces or newlines in canonical JSON
      expect(result.attestationPayload.contains(' '), isFalse);
      expect(result.attestationPayload.contains('\n'), isFalse);
    });
  });

  group('Signing', () {
    test('build_SignatureAttached_Base64Encoded', () async {
      final decision = const AttestationDecision(selectedOption: 'approve');

      final result = await builder.build(
        requestId: 'req-1',
        deviceId: 'dev-1',
        decision: decision,
        type: RequestType.select,
      );

      expect(result.deviceSignature, isNotEmpty);
      // Fake crypto returns predictable base64
      expect(result.deviceSignature, equals(fakeCrypto.lastSignature));
    });

    test('build_IncludesRequestIdAndDeviceId', () async {
      final decision = const AttestationDecision(selectedOption: 'ok');

      final result = await builder.build(
        requestId: 'req-abc',
        deviceId: 'dev-xyz',
        decision: decision,
        type: RequestType.select,
      );

      expect(result.requestId, equals('req-abc'));
      expect(result.deviceId, equals('dev-xyz'));
    });
  });

  // --- Non-happy path ---

  group('Validation errors', () {
    test('build_SelectType_NullSelection_ThrowsValidationError', () async {
      final decision = const AttestationDecision(); // No selectedOption

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.select),
        throwsA(isA<AttestationValidationError>()),
      );
    });

    test('build_MultiselectType_EmptyList_ThrowsValidationError', () async {
      final decision = const AttestationDecision(selectedOptions: []);

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.multiselect),
        throwsA(isA<AttestationValidationError>()),
      );
    });

    test('build_TextType_EmptyString_ThrowsValidationError', () async {
      final decision = const AttestationDecision(value: '');

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.text),
        throwsA(isA<AttestationValidationError>()),
      );
    });

    test('build_NumberType_NonNumeric_ThrowsValidationError', () async {
      final decision = const AttestationDecision(value: 'not a number');

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.number),
        throwsA(isA<AttestationValidationError>()),
      );
    });

    test('build_SignatureType_EmptyData_ThrowsValidationError', () async {
      final decision = const AttestationDecision(signatureData: '');

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.signature),
        throwsA(isA<AttestationValidationError>()),
      );
    });

    test('build_CryptoServiceFails_PropagatesError', () async {
      fakeCrypto.shouldFail = true;
      final decision = const AttestationDecision(selectedOption: 'ok');

      expect(
        () => builder.build(requestId: 'req-1', deviceId: 'dev-1', decision: decision, type: RequestType.select),
        throwsA(isA<CryptoSigningError>()),
      );
    });
  });
}

/// Extract top-level keys from a JSON string in order of appearance.
List<String> _extractKeyOrder(String json) {
  final map = jsonDecode(json) as Map<String, dynamic>;
  return map.keys.toList();
}

/// Fake crypto service for testing (no platform dependency).
class _FakeCryptoService implements CryptoServiceInterface {
  bool shouldFail = false;
  String lastSignature = '';

  @override
  Future<String> sign(String payload) async {
    if (shouldFail) throw CryptoSigningError('Simulated signing failure');
    lastSignature = base64Encode(utf8.encode('signed:$payload'));
    return lastSignature;
  }

  @override
  Future<DevicePublicKey> ensurePublicKey() async =>
      const DevicePublicKey(publicKeyPem: 'fake-pem', algorithm: 'ES256');
}
