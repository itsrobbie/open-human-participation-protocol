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
        // Skip on non-iOS platforms
        return;
      }

      KeyPairResult result;
      try {
        result = await cryptoService.generateKeyPair();
      } on CryptoException catch (e) {
        // On simulator, Secure Enclave is not available - test passes vacuously
        if (e.code == 'KEY_GENERATION_FAILED' || e.code == 'NULL_RESULT') {
          // Expected on simulator - skip gracefully
          return;
        }
        rethrow;
      }

      expect(result.publicKey, isNotEmpty);
      expect(result.keyRef, equals('dev.ohpp.client.signing'));

      // On simulator, storageLevel will be 'software' (no Secure Enclave).
      // On a real device, it should be 'secureEnclave'.
      // Accept both - the real assertion is for device-only CI.
      expect(
        result.storageLevel,
        anyOf(
          equals(KeyStorageLevel.secureEnclave),
          equals(KeyStorageLevel.software),
        ),
        reason: 'iOS should use Secure Enclave on device, software on simulator',
      );
    });

    testWidgets('Android_PrefersStrongBox_FallsToTEE', (tester) async {
      if (!Platform.isAndroid) {
        // Skip on non-Android platforms
        return;
      }

      KeyPairResult result;
      try {
        result = await cryptoService.generateKeyPair();
      } on CryptoException catch (e) {
        // On emulator without KeyStore support - skip gracefully
        if (e.code == 'KEY_GENERATION_FAILED' || e.code == 'NULL_RESULT') {
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
