import 'package:ohpp_client/shared/models/enums.dart';

/// Result of a biometric authentication attempt.
enum AuthResult {
  success,
  cancelled,
  lockedOut,
  unavailable,
}

/// Interface for platform biometric authentication.
/// Wrapped to allow testing without actual hardware.
abstract class BiometricProvider {
  Future<bool> authenticate({required String reason, required bool biometricOnly});
  Future<bool> isBiometricAvailable();
  Future<bool> isDeviceSupported();
}

/// Service that handles authentication prompts based on the configured AuthLevel.
class BiometricService {
  final BiometricProvider _provider;

  BiometricService({required BiometricProvider provider}) : _provider = provider;

  /// Authenticate the user at the specified level.
  /// Returns immediately for AuthLevel.none.
  Future<AuthResult> authenticate({
    required AuthLevel level,
    String reason = 'Authenticate to sign your response',
  }) async {
    switch (level) {
      case AuthLevel.none:
        return AuthResult.success;

      case AuthLevel.devicePasscode:
        return _doAuth(reason: reason, biometricOnly: false);

      case AuthLevel.biometric:
        final available = await _provider.isBiometricAvailable();
        if (!available) {
          // Biometric not enrolled or hardware unavailable
          // Fall back to passcode
          final deviceSupported = await _provider.isDeviceSupported();
          if (!deviceSupported) return AuthResult.unavailable;
          return _doAuth(reason: reason, biometricOnly: false);
        }
        return _doAuth(reason: reason, biometricOnly: true);
    }
  }

  /// Get available authentication methods on this device.
  Future<List<AuthLevel>> getAvailableMethods() async {
    final methods = <AuthLevel>[AuthLevel.none];

    final deviceSupported = await _provider.isDeviceSupported();
    if (deviceSupported) {
      methods.add(AuthLevel.devicePasscode);
    }

    final biometricAvailable = await _provider.isBiometricAvailable();
    if (biometricAvailable) {
      methods.add(AuthLevel.biometric);
    }

    return methods;
  }

  Future<AuthResult> _doAuth({required String reason, required bool biometricOnly}) async {
    try {
      final success = await _provider.authenticate(
        reason: reason,
        biometricOnly: biometricOnly,
      );
      return success ? AuthResult.success : AuthResult.cancelled;
    } catch (_) {
      return AuthResult.lockedOut;
    }
  }
}
