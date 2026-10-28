import 'package:dio/dio.dart';

import 'package:ohpp_client/core/telemetry/telemetry_service.dart';

import 'api_exceptions.dart';

/// Interface for Dio (allows faking in tests without mockito codegen).
abstract class DioInterface {
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters, Options? options});
  Future<Response<T>> post<T>(String path, {Object? data, Options? options});
  Future<Response<T>> put<T>(String path, {Object? data, Options? options});
  Future<Response<T>> delete<T>(String path, {Options? options});
}

/// Typed API client with all Resolver endpoints and error mapping.
class TypedApiClient {
  final DioInterface _dio;
  final TelemetryService _telemetry;

  TypedApiClient({
    required DioInterface dio,
    TelemetryService telemetry = const NoopTelemetryService(),
  })  : _dio = dio,
        _telemetry = telemetry;

  // --- Device endpoints ---

  Future<List<Map<String, dynamic>>> getPendingRequests() async {
    final response = await _telemetry.trace(
      'api.getPendingRequests',
      () => _call(() => _dio.get<dynamic>('/api/devices/me/pending')),
    );
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> submitAttestation({
    required String requestId,
    required String attestationPayload,
    required String deviceSignature,
  }) async {
    // Traced with the OHPP request id so the app's submit joins the ceremony in
    // Grafana. Telemetry is a no-op unless OTEL_ENDPOINT is configured.
    await _telemetry.trace(
      'api.submitAttestation',
      () => _call(() => _dio.post<dynamic>('/api/devices/me/attestations', data: {
            'requestId': requestId,
            'attestationPayload': attestationPayload,
            'deviceSignature': deviceSignature,
          })),
      requestId: requestId,
    );
  }

  /// Register this device's public key so the resolver can verify the device's
  /// attestation signatures. Idempotent server-side (re-registering the same
  /// device's key replaces it).
  Future<void> registerDeviceKey({
    required String publicKeyPem,
    String algorithm = 'ES256',
  }) async {
    await _telemetry.trace(
      'api.registerDeviceKey',
      () => _call(() => _dio.post<dynamic>('/api/devices/me/keys', data: {
            'publicKey': publicKeyPem,
            'algorithm': algorithm,
          })),
    );
  }

  Future<void> registerPushToken(String token) async {
    await _call(() => _dio.post<dynamic>('/api/devices/me/push-token', data: {
      'token': token,
    }));
  }

  // --- Registration endpoints ---

  Future<Map<String, dynamic>> processChallenge(String challengePayload) async {
    final response = await _call(() => _dio.post<dynamic>(
      '/api/registrations/process-challenge',
      data: {'challengePayload': challengePayload},
    ));
    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getRegisteredApps() async {
    final response = await _call(() => _dio.get<dynamic>('/api/registrations/apps'));
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> revokeApp(String id) async {
    await _call(() => _dio.delete<dynamic>('/api/registrations/apps/$id'));
  }

  // --- Rules endpoints ---

  Future<List<Map<String, dynamic>>> getRules() async {
    final response = await _call(() => _dio.get<dynamic>('/api/rules'));
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  /// The current user's registered (active) devices. Identity-token scoped
  /// (/api/devices, not /api/devices/me). The resolver cannot know which device
  /// is asking, so it returns no 'current' flag; the caller marks current by
  /// matching the locally-stored device id.
  Future<List<Map<String, dynamic>>> getDevices() async {
    final response = await _call(() => _dio.get<dynamic>('/api/devices'));
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createRule(Map<String, dynamic> ruleData) async {
    final response = await _call(() => _dio.post<dynamic>('/api/rules', data: ruleData));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateRule(String id, Map<String, dynamic> ruleData) async {
    final response = await _call(() => _dio.put<dynamic>('/api/rules/$id', data: ruleData));
    return response.data as Map<String, dynamic>;
  }

  Future<void> deleteRule(String id) async {
    await _call(() => _dio.delete<dynamic>('/api/rules/$id'));
  }

  Future<void> reorderRules(List<String> ruleIds) async {
    await _call(() => _dio.put<dynamic>('/api/rules/reorder', data: {'ruleIds': ruleIds}));
  }

  // --- History endpoints ---

  Future<Map<String, dynamic>> getHistory({required int page, required int pageSize}) async {
    final response = await _call(() => _dio.get<dynamic>(
      '/api/history',
      queryParameters: {'page': page, 'pageSize': pageSize},
    ));
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getHistoryDetail(String id) async {
    final response = await _call(() => _dio.get<dynamic>('/api/history/$id'));
    return response.data as Map<String, dynamic>;
  }

  // --- Notification preferences ---

  Future<List<Map<String, dynamic>>> getNotificationPreferences() async {
    final response = await _call(() => _dio.get<dynamic>('/api/notification-preferences'));
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> updateNotificationPreference(String appId, Map<String, dynamic> data) async {
    await _call(() => _dio.put<dynamic>('/api/notification-preferences/$appId', data: data));
  }

  // --- User profile ---

  Future<Map<String, dynamic>> createOrGetProfile() async {
    final response = await _call(() => _dio.post<dynamic>('/api/users/me'));
    return response.data as Map<String, dynamic>;
  }

  // --- Error-mapped call wrapper ---

  Future<Response<T>> _call<T>(Future<Response<T>> Function() apiCall) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      throw _mapDioException(e);
    }
  }

  ApiException _mapDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
        return const ConnectivityException();
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return const ApiTimeoutException();
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode ?? 0;
        if (statusCode == 401) return const AuthException();
        if (statusCode == 400) return const ValidationException();
        if (statusCode == 409) return const AlreadyResolvedException();
        if (statusCode >= 500) return const ServerException();
        return ServerException('Unexpected status: $statusCode');
      default:
        return const ConnectivityException('Unknown network error');
    }
  }
}
