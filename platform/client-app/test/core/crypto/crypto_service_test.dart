import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/crypto/crypto_service.dart';
import 'package:ohpp_client/shared/models/enums.dart';

void main() {
  late CryptoService cryptoService;

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    cryptoService = CryptoService();
  });

  void mockMethodChannel(Map<String, dynamic> Function(MethodCall) handler) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('dev.ohpp/crypto'),
      (MethodCall call) async => handler(call),
    );
  }

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('dev.ohpp/crypto'), null);
  });

  // --- Happy path ---

  group('generateKeyPair', () {
    test('generateKeyPair_ReturnsPublicKeyAndRef', () async {
      mockMethodChannel((call) {
        if (call.method == 'generateKeyPair') {
          return {
            'publicKey': 'MFkwEwYHKoZIzj0CAQY...',
            'keyRef': 'ohpp_signing_key_1',
            'storageLevel': 'secureEnclave',
          };
        }
        throw PlatformException(code: 'unknown');
      });

      final result = await cryptoService.generateKeyPair();

      expect(result.publicKey, equals('MFkwEwYHKoZIzj0CAQY...'));
      expect(result.keyRef, equals('ohpp_signing_key_1'));
    });

    test('generateKeyPair_ReportsStorageLevel', () async {
      mockMethodChannel((call) {
        if (call.method == 'generateKeyPair') {
          return {
            'publicKey': 'key_data',
            'keyRef': 'ref_1',
            'storageLevel': 'hardwareKeystore',
          };
        }
        throw PlatformException(code: 'unknown');
      });

      final result = await cryptoService.generateKeyPair();

      expect(result.storageLevel, equals(KeyStorageLevel.hardwareKeystore));
    });
  });

  group('sign', () {
    test('sign_ValidPayload_ReturnsBase64Signature', () async {
      mockMethodChannel((call) {
        if (call.method == 'sign') {
          return {'signature': 'MEUCIQD...'};
        }
        throw PlatformException(code: 'unknown');
      });

      final signature = await cryptoService.sign('payload data');

      expect(signature, equals('MEUCIQD...'));
      expect(signature, isNotEmpty);
    });

    test('sign_DifferentPayloads_DifferentSignatures', () async {
      var callCount = 0;
      mockMethodChannel((call) {
        if (call.method == 'sign') {
          callCount++;
          return {'signature': 'sig_$callCount'};
        }
        throw PlatformException(code: 'unknown');
      });

      final sig1 = await cryptoService.sign('payload_a');
      final sig2 = await cryptoService.sign('payload_b');

      expect(sig1, isNot(equals(sig2)));
    });
  });

  group('getStorageLevel', () {
    test('getStorageLevel_ReturnsDeviceCapability', () async {
      mockMethodChannel((call) {
        if (call.method == 'getStorageLevel') {
          return {'storageLevel': 'secureEnclave'};
        }
        throw PlatformException(code: 'unknown');
      });

      final level = await cryptoService.getStorageLevel();

      expect(level, equals(KeyStorageLevel.secureEnclave));
    });
  });

  // --- Non-happy path ---

  group('error handling', () {
    test('generateKeyPair_AlreadyExists_ReturnsExisting', () async {
      mockMethodChannel((call) {
        if (call.method == 'generateKeyPair') {
          return {
            'publicKey': 'existing_key',
            'keyRef': 'existing_ref',
            'storageLevel': 'secureEnclave',
          };
        }
        throw PlatformException(code: 'unknown');
      });

      // Call twice - should return existing on second call
      final first = await cryptoService.generateKeyPair();
      final second = await cryptoService.generateKeyPair();

      expect(first.publicKey, equals(second.publicKey));
    });

    test('sign_InvalidKeyRef_ThrowsError', () async {
      mockMethodChannel((call) {
        if (call.method == 'sign') {
          throw PlatformException(code: 'KEY_NOT_FOUND', message: 'No key with that reference');
        }
        throw PlatformException(code: 'unknown');
      });

      expect(
        () => cryptoService.sign('payload'),
        throwsA(isA<CryptoException>()),
      );
    });

    test('sign_BiometricCancelled_ThrowsCancelledError', () async {
      mockMethodChannel((call) {
        if (call.method == 'sign') {
          throw PlatformException(code: 'USER_CANCELLED', message: 'Biometric cancelled');
        }
        throw PlatformException(code: 'unknown');
      });

      expect(
        () => cryptoService.sign('payload'),
        throwsA(isA<BiometricCancelledException>()),
      );
    });

    test('deleteKey_ValidRef_RemovesKey', () async {
      mockMethodChannel((call) {
        if (call.method == 'deleteKey') {
          return {'deleted': true};
        }
        throw PlatformException(code: 'unknown');
      });

      // Should not throw
      await cryptoService.deleteKey('some_ref');
    });

    test('deleteKey_InvalidRef_NoError', () async {
      mockMethodChannel((call) {
        if (call.method == 'deleteKey') {
          return {'deleted': false};
        }
        throw PlatformException(code: 'unknown');
      });

      // Should not throw even if key doesn't exist
      await cryptoService.deleteKey('nonexistent_ref');
    });
  });
}
