import 'dart:io';

import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:ohpp_client/core/observability/dev_logger.dart';

/// Manages device identity with the Resolver.
///
/// On first login, registers this device via POST /api/devices and stores the
/// returned deviceId + deviceToken in secure storage. On subsequent launches,
/// reads the stored values.
///
/// The deviceToken is a bearer token that authenticates device-specific API
/// calls (pending requests, attestation submission, SSE events).
class DeviceRegistrationService {
  final FlutterSecureStorage _storage;
  final String resolverBaseUrl;

  static const keyDeviceId = 'ohpp_device_id';
  static const keyDeviceToken = 'ohpp_device_token';
  static const keyInstallId = 'ohpp_install_id';
  // Deprecated private aliases kept internal for readability below.
  static const _keyDeviceId = keyDeviceId;
  static const _keyDeviceToken = keyDeviceToken;

  /// Stable per-install identifier sent to the resolver so it can key devices
  /// on (user, install) and avoid duplicate device rows. Generated once and
  /// persisted in secure storage; survives logout (unlike the device token).
  Future<String> _installId() async {
    final existing = await _storage.read(key: keyInstallId);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = _uuidV4();
    await _storage.write(key: keyInstallId, value: id);
    return id;
  }

  /// RFC 4122 v4 UUID from a cryptographically secure RNG.
  static String _uuidV4() {
    final rnd = Random.secure();
    final b = List<int>.generate(16, (_) => rnd.nextInt(256));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 1
    String hex(int start, int end) => b
        .sublist(start, end)
        .map((x) => x.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
  }

  DeviceRegistrationService({
    required FlutterSecureStorage storage,
    required this.resolverBaseUrl,
  }) : _storage = storage;

  /// Get the stored device ID, or null if not yet registered.
  Future<String?> getDeviceId() => _storage.read(key: _keyDeviceId);

  /// Get the stored device token, or null if not yet registered.
  Future<String?> getDeviceToken() => _storage.read(key: _keyDeviceToken);

  /// Check if a device is already registered.
  Future<bool> get isRegistered async =>
      await _storage.read(key: _keyDeviceId) != null;

  /// Ensure the device is registered with the Resolver.
  /// If already registered, returns the stored device ID.
  /// If not, calls POST /api/devices with the identity token and stores the result.
  Future<String?> ensureRegistered({required String identityToken}) async {
    // Check for existing registration
    final existingId = await _storage.read(key: _keyDeviceId);
    if (existingId != null) {
      final storedToken = await _storage.read(key: _keyDeviceToken);
      DevLog.instance.info('device',
          'Already registered (deviceId=$existingId, deviceToken=${storedToken != null ? 'present' : 'MISSING'})');
      if (storedToken == null) {
        // Stale state: id without a token means device-scoped calls will 401.
        DevLog.instance.warning('device',
            'deviceId present but device token missing — re-registering');
        return _registerDevice(identityToken);
      }

      // The token may be STALE: on iOS the keychain survives app deletion, and
      // the device may have been revoked/removed server-side. A stored token is
      // not proof it still works, so validate it. If the server rejects it
      // (401), clear the dead credentials and re-register. Because registration
      // is idempotent on the install id, this reconnects to the same device row
      // rather than creating a duplicate.
      if (await _isDeviceTokenValid(storedToken)) {
        return existingId;
      }
      DevLog.instance.warning('device',
          'stored device token rejected by resolver (stale) — re-registering');
      await clearRegistration();
      return _registerDevice(identityToken);
    }

    DevLog.instance.info('device', 'No existing registration; registering new device');
    // Register new device
    return _registerDevice(identityToken);
  }

  /// Probe a device-scoped endpoint to confirm the stored device token is still
  /// accepted by the resolver. Returns false on a 401/403 (stale/revoked),
  /// true on success. Network errors are treated as "assume valid" so we don't
  /// needlessly re-register when merely offline.
  Future<bool> _isDeviceTokenValid(String deviceToken) async {
    try {
      final dio = Dio(BaseOptions(
        baseUrl: resolverBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        validateStatus: (_) => true, // inspect the code ourselves
      ));
      final response = await dio.get<dynamic>(
        '/api/devices/me/pending',
        options: Options(headers: {'Authorization': 'Bearer $deviceToken'}),
      );
      final code = response.statusCode ?? 0;
      if (code == 401 || code == 403) return false;
      return true;
    } on DioException catch (e) {
      // Could not reach the resolver: don't destroy a possibly-valid token.
      DevLog.instance.warning('device',
          'could not validate device token (${e.type.name}); assuming valid');
      return true;
    }
  }

  /// Register a new device with the Resolver.
  Future<String?> _registerDevice(String identityToken) async {
    try {
      final dio = Dio(BaseOptions(
        baseUrl: resolverBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));

      final deviceName = await _getDeviceName();
      final installId = await _installId();

      DevLog.instance.info('device',
          '→ POST $resolverBaseUrl/api/devices (name=$deviceName, install=$installId)');
      final response = await dio.post<Map<String, dynamic>>(
        '/api/devices',
        data: {
          'name': deviceName,
          'deviceType': Platform.isIOS ? 'ios' : 'android',
          'deviceIdentifier': installId,
        },
        options: Options(
          headers: {'Authorization': 'Bearer $identityToken'},
        ),
      );

      DevLog.instance.info('device',
          '← ${response.statusCode} POST $resolverBaseUrl/api/devices');

      if (response.statusCode == 201 && response.data != null) {
        final data = response.data!;
        final deviceId = data['id'] as String?;
        final deviceToken = data['deviceToken'] as String?;

        if (deviceId != null && deviceToken != null) {
          await _storage.write(key: _keyDeviceId, value: deviceId);
          await _storage.write(key: _keyDeviceToken, value: deviceToken);
          debugPrint('[DeviceRegistration] Registered device: $deviceId');
          DevLog.instance.info('device',
              'Stored deviceId=$deviceId and device token (${deviceToken.length} chars)');
          return deviceId;
        }
        DevLog.instance.error('device',
            'Registration 201 but response missing id/deviceToken',
            detail: 'keys=${data.keys.toList()}');
      } else {
        DevLog.instance.error('device',
            'Registration returned ${response.statusCode} (expected 201)');
      }
      return null;
    } on DioException catch (e) {
      debugPrint('[DeviceRegistration] Failed: ${e.message}');
      DevLog.instance.error('device',
          'POST /api/devices threw ${e.type.name}',
          detail: 'status=${e.response?.statusCode} '
              'message=${e.message} '
              'body=${e.response?.data}');
      return null;
    }
  }

  /// Register the device's signing public key with the Resolver so it can
  /// verify future attestation signatures (POST /api/devices/me/keys, device
  /// token auth). Idempotent server-side. Returns true on success.
  ///
  /// This is the second half of device onboarding: [ensureRegistered] creates
  /// the device and stores its token; this publishes the public key whose
  /// private half the crypto service signs with. Without it, the resolver
  /// rejects every attestation with "Device signature verification failed".
  Future<bool> registerPublicKey({
    required String publicKeyPem,
    String algorithm = 'ES256',
  }) async {
    final deviceToken = await _storage.read(key: _keyDeviceToken);
    if (deviceToken == null) {
      DevLog.instance.warning('device',
          'registerPublicKey skipped: no device token stored');
      return false;
    }
    try {
      final dio = Dio(BaseOptions(
        baseUrl: resolverBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));
      DevLog.instance.info('device',
          '→ POST $resolverBaseUrl/api/devices/me/keys (alg=$algorithm)');
      final response = await dio.post<Map<String, dynamic>>(
        '/api/devices/me/keys',
        data: {'publicKey': publicKeyPem, 'algorithm': algorithm},
        options: Options(headers: {'Authorization': 'Bearer $deviceToken'}),
      );
      DevLog.instance.info('device',
          '← ${response.statusCode} POST /api/devices/me/keys');
      return response.statusCode == 200;
    } on DioException catch (e) {
      DevLog.instance.error('device',
          'POST /api/devices/me/keys threw ${e.type.name}',
          detail: 'status=${e.response?.statusCode} body=${e.response?.data}');
      return false;
    }
  }

  /// Clear stored device credentials (used on logout or device revocation).
  Future<void> clearRegistration() async {
    await _storage.delete(key: _keyDeviceId);
    await _storage.delete(key: _keyDeviceToken);
  }

  /// Get a human-readable device name.
  Future<String> _getDeviceName() async {
    if (Platform.isIOS) {
      return 'iPhone'; // Could use device_info_plus for model name
    } else if (Platform.isAndroid) {
      return 'Android';
    }
    return 'Unknown Device';
  }
}
