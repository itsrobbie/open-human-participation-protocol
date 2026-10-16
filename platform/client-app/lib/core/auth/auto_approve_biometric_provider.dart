import 'package:ohpp_client/core/auth/biometric_service.dart';

/// Agent-friendly biometric provider for simulators and automated tests.
///
/// The human-presence gate exists so no on-device agent can answer for the
/// user. That gate cannot be satisfied by an automated agent on a simulator, so
/// in the `test` anti-agent mode we substitute this provider, which always
/// approves. It is the biometric counterpart to [AgentCryptoService].
///
/// This must never be selected on a release/device build. Selection happens
/// once at the composition root via the build-time anti-agent mode flag.
class AutoApproveBiometricProvider implements BiometricProvider {
  const AutoApproveBiometricProvider();

  @override
  Future<bool> authenticate({
    required String reason,
    required bool biometricOnly,
  }) async =>
      true;

  @override
  Future<bool> isBiometricAvailable() async => true;

  @override
  Future<bool> isDeviceSupported() async => true;
}
