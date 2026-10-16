import 'package:flutter/services.dart';
import 'package:ohpp_client/shared/models/enums.dart';

/// Exception thrown for crypto operation failures.
class CryptoException implements Exception {
  final String code;
  final String message;
  CryptoException({required this.code, required this.message});

  @override
  String toString() => 'CryptoException($code): $message';
}

/// Exception thrown when user cancels biometric during key access.
class BiometricCancelledException implements Exception {
  @override
  String toString() => 'BiometricCancelledException: User cancelled biometric authentication';
}

/// Result of key pair generation.
class KeyPairResult {
  final String publicKey;
  final String keyRef;
  final KeyStorageLevel storageLevel;

  const KeyPairResult({
    required this.publicKey,
    required this.keyRef,
    required this.storageLevel,
  });
}

/// Platform channel interface for cryptographic operations.
/// iOS: Secure Enclave (SecKey)
/// Android: KeyStore / StrongBox
class CryptoService {
  static const _channel = MethodChannel('dev.ohpp/crypto');

  /// Generate an ES256 key pair in the highest available security level.
  Future<KeyPairResult> generateKeyPair() async {
    try {
      final result = await _channel.invokeMapMethod<String, dynamic>('generateKeyPair');

      if (result == null) {
        throw CryptoException(code: 'NULL_RESULT', message: 'Platform returned null');
      }

      return KeyPairResult(
        publicKey: result['publicKey'] as String,
        keyRef: result['keyRef'] as String,
        storageLevel: _parseStorageLevel(result['storageLevel'] as String),
      );
    } on PlatformException catch (e) {
      throw CryptoException(code: e.code, message: e.message ?? 'Unknown error');
    }
  }

  /// Sign a payload with the device's private key.
  /// May trigger biometric prompt depending on key access control.
  Future<String> sign(String payload) async {
    try {
      final result = await _channel.invokeMapMethod<String, dynamic>('sign', {
        'payload': payload,
      });

      if (result == null) {
        throw CryptoException(code: 'NULL_RESULT', message: 'Platform returned null');
      }

      return result['signature'] as String;
    } on PlatformException catch (e) {
      if (e.code == 'USER_CANCELLED') {
        throw BiometricCancelledException();
      }
      throw CryptoException(code: e.code, message: e.message ?? 'Signing failed');
    }
  }

  /// Get the current key storage level for this device.
  Future<KeyStorageLevel> getStorageLevel() async {
    try {
      final result = await _channel.invokeMapMethod<String, dynamic>('getStorageLevel');

      if (result == null) {
        return KeyStorageLevel.software;
      }

      return _parseStorageLevel(result['storageLevel'] as String);
    } on PlatformException {
      return KeyStorageLevel.software;
    }
  }

  /// Delete the signing key (used during key rotation or device revocation).
  Future<void> deleteKey(String keyRef) async {
    try {
      await _channel.invokeMapMethod<String, dynamic>('deleteKey', {
        'keyRef': keyRef,
      });
    } on PlatformException {
      // Deletion failure is non-fatal (key may already be gone)
    }
  }

  KeyStorageLevel _parseStorageLevel(String value) {
    switch (value) {
      case 'secureEnclave':
        return KeyStorageLevel.secureEnclave;
      case 'hardwareKeystore':
        return KeyStorageLevel.hardwareKeystore;
      default:
        return KeyStorageLevel.software;
    }
  }
}
