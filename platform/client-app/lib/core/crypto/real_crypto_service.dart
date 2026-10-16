import 'package:ohpp_client/core/crypto/crypto_service.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';

/// Real signer backed by the platform Secure Enclave / hardware KeyStore via
/// the `dev.ohpp/crypto` MethodChannel. Selected on release/device builds so
/// the signing key is hardware-bound and biometric-gated: no on-device agent
/// can sign on the user's behalf.
///
/// Unlike the previous AdaptiveCryptoService, this does NOT silently fall back
/// to a software/dev signer. If the platform crypto is unavailable, signing
/// fails loudly — a real build must never degrade the anti-agent guarantee.
class RealCryptoService implements CryptoServiceInterface {
  final CryptoService _platform;

  RealCryptoService({CryptoService? platform})
      : _platform = platform ?? CryptoService();

  @override
  Future<DevicePublicKey> ensurePublicKey() async {
    // Generating is idempotent-enough for our needs: the native side returns
    // the existing key's public part when one already exists, or creates one.
    final pair = await _platform.generateKeyPair();
    return DevicePublicKey(publicKeyPem: pair.publicKey, algorithm: 'ES256');
  }

  @override
  Future<String> sign(String payload) async {
    try {
      return await _platform.sign(payload);
    } on CryptoException catch (e) {
      // KEY_NOT_FOUND: the channel works but no key exists yet. Create one and
      // retry once. Any other crypto error propagates — no dev-signer fallback.
      if (e.code == 'KEY_NOT_FOUND') {
        await _platform.generateKeyPair();
        return _platform.sign(payload);
      }
      rethrow;
    }
  }
}
