import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/auth/biometric_service.dart';
import 'package:ohpp_client/shared/models/enums.dart';

void main() {
  late BiometricService service;
  late _FakeBiometricProvider provider;

  setUp(() {
    provider = _FakeBiometricProvider();
    service = BiometricService(provider: provider);
  });

  // --- Happy path ---

  group('authenticate - success', () {
    test('authenticate_LevelNone_ReturnsSuccessImmediately', () async {
      final result = await service.authenticate(level: AuthLevel.none);

      expect(result, equals(AuthResult.success));
      expect(provider.authenticateCalled, isFalse);
    });

    test('authenticate_LevelPasscode_PromptsPasscode', () async {
      provider.authResult = true;

      final result = await service.authenticate(level: AuthLevel.devicePasscode);

      expect(result, equals(AuthResult.success));
      expect(provider.lastBiometricOnly, isFalse);
    });

    test('authenticate_LevelBiometric_PromptsBiometric', () async {
      provider.biometricAvailable = true;
      provider.authResult = true;

      final result = await service.authenticate(level: AuthLevel.biometric);

      expect(result, equals(AuthResult.success));
      expect(provider.lastBiometricOnly, isTrue);
    });

    test('authenticate_Success_ReturnsAuthSuccess', () async {
      provider.authResult = true;

      final result = await service.authenticate(level: AuthLevel.devicePasscode);

      expect(result, equals(AuthResult.success));
    });

    test('getAvailableMethods_ReturnsPlatformCapabilities', () async {
      provider.biometricAvailable = true;
      provider.deviceSupported = true;

      final methods = await service.getAvailableMethods();

      expect(methods, contains(AuthLevel.none));
      expect(methods, contains(AuthLevel.devicePasscode));
      expect(methods, contains(AuthLevel.biometric));
    });
  });

  // --- Non-happy path ---

  group('authenticate - failures', () {
    test('authenticate_UserCancels_ReturnsCancelled', () async {
      provider.authResult = false;

      final result = await service.authenticate(level: AuthLevel.devicePasscode);

      expect(result, equals(AuthResult.cancelled));
    });

    test('authenticate_BiometricNotEnrolled_FallsToPasscode', () async {
      provider.biometricAvailable = false;
      provider.deviceSupported = true;
      provider.authResult = true;

      final result = await service.authenticate(level: AuthLevel.biometric);

      // Falls back to passcode (biometricOnly = false)
      expect(result, equals(AuthResult.success));
      expect(provider.lastBiometricOnly, isFalse);
    });

    test('authenticate_HardwareUnavailable_FallsToPasscode', () async {
      provider.biometricAvailable = false;
      provider.deviceSupported = true;
      provider.authResult = true;

      final result = await service.authenticate(level: AuthLevel.biometric);

      expect(result, equals(AuthResult.success));
      expect(provider.lastBiometricOnly, isFalse);
    });

    test('authenticate_Lockout_ReturnsLockedOut', () async {
      provider.shouldThrow = true;

      final result = await service.authenticate(level: AuthLevel.devicePasscode);

      expect(result, equals(AuthResult.lockedOut));
    });

    test('authenticate_BiometricOnly_NoFallback_ReturnsUnavailable', () async {
      provider.biometricAvailable = false;
      provider.deviceSupported = false;

      final result = await service.authenticate(level: AuthLevel.biometric);

      expect(result, equals(AuthResult.unavailable));
    });
  });
}

class _FakeBiometricProvider implements BiometricProvider {
  bool authResult = false;
  bool biometricAvailable = false;
  bool deviceSupported = true;
  bool shouldThrow = false;
  bool authenticateCalled = false;
  bool? lastBiometricOnly;

  @override
  Future<bool> authenticate({required String reason, required bool biometricOnly}) async {
    authenticateCalled = true;
    lastBiometricOnly = biometricOnly;
    if (shouldThrow) throw Exception('Lockout');
    return authResult;
  }

  @override
  Future<bool> isBiometricAvailable() async => biometricAvailable;

  @override
  Future<bool> isDeviceSupported() async => deviceSupported;
}
