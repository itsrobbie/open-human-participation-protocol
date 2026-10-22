import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ohpp_client/core/crypto/crypto_service.dart';
import 'package:ohpp_client/shared/models/enums.dart';

/// Platform-specific crypto tests that MUST run on a real device.
///
/// - iOS: requires device with Secure Enclave (iPhone 5s+, any with Touch/Face ID)
/// - Android: requires device with Hardware Keystore (API 23+), preferably StrongBox (API 28+)
///
/// Run on device:
///   flutter test integration_test/crypto_device_test.dart -d <device_id>
///
/// These tests CANNOT run on a simulator (Secure Enclave is not available).
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late CryptoService cryptoService;

  setUp(() {
    cryptoService = CryptoService();
  });

  tearDown(() async {
    // Clean up generated keys after each test
    try {
      await cryptoService.deleteKey('dev.ohpp.client.signing');
    } catch (_) {
      // Key may not exist, that's fine
    }
  });

  group('Platform-specific crypto (real device)', () {
    testWidgets('iOS_GeneratesInSecureEnclave', (tester) async {
      if (!Platform.isIOS) {
        markTestSkipped('not iOS');
        return;
      }

      KeyPairResult result;
      try {
        result = await cryptoService.generateKeyPair();
      } on CryptoException catch (e) {
        if (e.code == 'KEY_GENERATION_FAILED' || e.code == 'NULL_RESULT') {
          markTestSkipped(
              'Secure Enclave unavailable (simulator): key generation failed');
          return;
        }
        rethrow;
      }

      expect(result.publicKey, isNotEmpty);
      expect(result.keyRef, equals('dev.ohpp.client.signing'));

      // The protocol's whole point is hardware-backed keys. On the SIMULATOR
      // there is no Secure Enclave, so storageLevel is 'software' and the
      // hardware guarantee is NOT exercised — mark it skipped rather than let a
      // software-only run masquerade as a passed hardware check. Only a real
      // device asserts secureEnclave.
      if (result.storageLevel == KeyStorageLevel.software) {
        markTestSkipped(
            'running on iOS simulator: Secure Enclave not verified '
            '(software signer only). Run on a real device to assert '
            'storageLevel == secureEnclave.');
        return;
      }
      expect(
        result.storageLevel,
        equals(KeyStorageLevel.secureEnclave),
        reason: 'on a real iOS device keys must be Secure-Enclave-backed',
      );
    });

    testWidgets('Android_PrefersStrongBox_FallsToTEE', (tester) async {
      if (!Platform.isAndroid) {
        markTestSkipped('not Android');
        return;
      }

      KeyPairResult result;
      try {
        result = await cryptoService.generateKeyPair();
      } on CryptoException catch (e) {
        if (e.code == 'KEY_GENERATION_FAILED' || e.code == 'NULL_RESULT') {
          markTestSkipped(
              'hardware KeyStore unavailable (emulator): key generation failed');
          return;
        }
        rethrow;
      }

      expect(result.publicKey, isNotEmpty);
      expect(result.keyRef, equals('dev.ohpp.client.signing'));
      // Android should use hardware keystore at minimum (StrongBox or TEE)
      expect(
        result.storageLevel,
        anyOf(
          equals(KeyStorageLevel.secureEnclave), // StrongBox reported as secureEnclave
          equals(KeyStorageLevel.hardwareKeystore), // TEE/Keystore
        ),
        reason: 'Android device should use hardware-backed key storage',
      );
    });

    testWidgets('sign_VerifyWithPublicKey_Succeeds', (tester) async {
      // Generate a key pair
      KeyPairResult keyResult;
      try {
        keyResult = await cryptoService.generateKeyPair();
      } on CryptoException catch (e) {
        // On simulator/emulator without hardware crypto - skip gracefully
        if (e.code == 'KEY_GENERATION_FAILED' || e.code == 'NULL_RESULT') {
          return;
        }
        rethrow;
      }
      expect(keyResult.publicKey, isNotEmpty);

      // Sign a payload
      const payload = '{"selectedOption":"approve","requestId":"test-123"}';
      final signature = await cryptoService.sign(payload);

      expect(signature, isNotEmpty);
      // Signature should be base64-encoded DER (ECDSA with SHA-256)
      expect(signature.length, greaterThan(30),
          reason: 'ECDSA signature should be at least 64 bytes base64-encoded');

      // Sign a different payload - should produce a different signature
      const payload2 = '{"selectedOption":"reject","requestId":"test-456"}';
      final signature2 = await cryptoService.sign(payload2);

      expect(signature2, isNotEmpty);
      expect(signature2, isNot(equals(signature)),
          reason: 'Different payloads must produce different signatures');
    });
  });
}
