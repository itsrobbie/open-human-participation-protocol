import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/core/api/typed_api_client.dart';
import 'package:ohpp_client/core/auth/biometric_service.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';
import 'package:ohpp_client/shared/models/models.dart';
import 'package:ohpp_client/shared/providers/attestation_service_provider.dart';

/// Bug 3: approving a request that has ALREADY expired shows "Validation
/// failed". Server-side the resolver rejects it (decision timestamp after
/// expiry -> HTTP 400 -> ValidationException('Validation failed')). The app
/// should not send an expired request at all: it should stop before biometric
/// and return a clear "expired" result. These tests pin that behavior.
void main() {
  late _RecordingBiometricProvider bio;
  late _RecordingDio dio;
  late AttestationService service;

  setUp(() {
    bio = _RecordingBiometricProvider();
    dio = _RecordingDio();
    service = AttestationService(
      ruleEngine: RuleEngine(),
      biometricService: BiometricService(provider: bio),
      attestationBuilder: AttestationBuilder(cryptoService: _FakeCrypto()),
      api: TypedApiClient(dio: dio),
      getDeviceId: () async => 'device-123',
      getRules: () => const [],
    );
  });

  ParticipationRequest request({DateTime? expiry}) => ParticipationRequest(
        requestId: 'r1',
        appId: 'bank.demo',
        summary: 'Approve payment',
        type: RequestType.select,
        receivedAt: DateTime.now().toUtc(),
        expiry: expiry,
      );

  const decision = AttestationDecision(selectedOption: 'approve');

  test('expired request fails fast with a clear message (Bug 3)', () async {
    final expired = request(
        expiry: DateTime.now().toUtc().subtract(const Duration(minutes: 1)));

    final result = await service.submit(expired, decision);

    expect(result.success, isFalse);
    expect(result.error, isNotNull);
    expect(result.error!.toLowerCase(), contains('expired'),
        reason: 'expired requests must say so, not "Validation failed"');
  });

  test('expired request does NOT prompt biometric or hit the API', () async {
    final expired = request(
        expiry: DateTime.now().toUtc().subtract(const Duration(minutes: 1)));

    await service.submit(expired, decision);

    expect(bio.authCalls, 0, reason: 'no biometric prompt for an expired request');
    expect(dio.postPaths, isEmpty, reason: 'no attestation POST for an expired request');
  });

  test('a still-valid request proceeds to submit', () async {
    final valid = request(
        expiry: DateTime.now().toUtc().add(const Duration(minutes: 10)));

    final result = await service.submit(valid, decision);

    expect(result.success, isTrue);
    expect(dio.postPaths, contains('/api/devices/me/attestations'));
  });
}

class _RecordingBiometricProvider implements BiometricProvider {
  int authCalls = 0;
  @override
  Future<bool> authenticate({required String reason, required bool biometricOnly}) async {
    authCalls++;
    return true;
  }

  @override
  Future<bool> isBiometricAvailable() async => true;
  @override
  Future<bool> isDeviceSupported() async => true;
}

class _FakeCrypto implements CryptoServiceInterface {
  @override
  Future<String> sign(String payload) async => 'sig-of-$payload';

  @override
  Future<DevicePublicKey> ensurePublicKey() async =>
      const DevicePublicKey(publicKeyPem: 'fake-pem', algorithm: 'ES256');
}

/// Minimal DioInterface fake that records POSTs and returns 200s.
class _RecordingDio implements DioInterface {
  final List<String> postPaths = [];

  Response<T> _ok<T>(String path) => Response<T>(
        requestOptions: RequestOptions(path: path),
        statusCode: 200,
        data: <String, dynamic>{} as T,
      );

  @override
  Future<Response<T>> get<T>(String path,
      {Map<String, dynamic>? queryParameters, Options? options}) async {
    throw UnimplementedError();
  }

  @override
  Future<Response<T>> post<T>(String path, {Object? data, Options? options}) async {
    postPaths.add(path);
    return _ok<T>(path);
  }

  @override
  Future<Response<T>> put<T>(String path, {Object? data, Options? options}) async {
    throw UnimplementedError();
  }

  @override
  Future<Response<T>> delete<T>(String path, {Options? options}) async {
    throw UnimplementedError();
  }
}
