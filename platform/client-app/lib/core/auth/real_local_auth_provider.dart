import 'package:local_auth/local_auth.dart';

import 'package:ohpp_client/core/auth/biometric_service.dart';

/// Real biometric provider backed by the platform's local authentication
/// (Face ID / Touch ID / device passcode). Selected on release/device builds.
///
/// This is the anti-agent gate: it MUST reflect the real result of the
/// platform prompt. Unlike the previous AdaptiveBiometricProvider, it never
/// silently auto-approves when the device is "unsupported" or when an error
/// occurs — a failure or unavailable device returns false (treated upstream as
/// cancelled/failed), so an on-device agent can never slip past the gate.
class RealLocalAuthProvider implements BiometricProvider {
  final LocalAuthentication _auth;

  RealLocalAuthProvider({LocalAuthentication? auth})
      : _auth = auth ?? LocalAuthentication();

  @override
  Future<bool> authenticate({
    required String reason,
    required bool biometricOnly,
  }) async {
    // Any exception (no enrolled biometrics, locked out, hardware error) is a
    // failed authentication, NOT an auto-approve. Fail closed.
    return _auth.authenticate(
      localizedReason: reason,
      options: AuthenticationOptions(
        biometricOnly: biometricOnly,
        stickyAuth: true,
      ),
    );
  }

  @override
  Future<bool> isBiometricAvailable() async {
    try {
      return await _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> isDeviceSupported() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }
}
