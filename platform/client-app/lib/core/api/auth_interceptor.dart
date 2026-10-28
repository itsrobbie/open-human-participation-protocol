import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Interceptor that attaches the Bearer token to requests and handles 401 with
/// automatic token refresh. Refresh goes through the RESOLVER's /api/auth/refresh,
/// never the identity provider directly, so the app names no provider.
class AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;

  /// Resolver refresh endpoint, e.g. "https://<host>/api/auth/refresh".
  final String refreshUrl;
  final void Function() onSessionExpired;

  Completer<String?>? _refreshCompleter;

  AuthInterceptor({
    required FlutterSecureStorage storage,
    required this.refreshUrl,
    required this.onSessionExpired,
  }) : _storage = storage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Device-scoped endpoints (/api/devices/me/*) require the DEVICE token
    // issued by POST /api/devices, not the identity token. The resolver enforces
    // [RequireTokenType(TokenType.Device)] on those routes, so sending the
    // identity access_token there returns 401.
    final token = _isDeviceScoped(options.path)
        ? await _storage.read(key: 'ohpp_device_token')
        : await _getValidToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  /// True for resolver routes that require the device token.
  bool _isDeviceScoped(String path) => path.contains('/api/devices/me');

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      // Device-scoped 401s are not fixable by an identity refresh (they use the
      // device token). Surface them rather than looping through refresh.
      if (_isDeviceScoped(err.requestOptions.path)) {
        handler.next(err);
        return;
      }
      // Attempt refresh
      final newToken = await _refreshToken();
      if (newToken != null) {
        // Retry original request with new token
        err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
        try {
          final dio = Dio();
          final response = await dio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        } on DioException catch (retryErr) {
          handler.next(retryErr);
          return;
        }
      } else {
        // Refresh failed, session expired
        onSessionExpired();
      }
    }
    handler.next(err);
  }

  Future<String?> _getValidToken() async {
    final expiresAtStr = await _storage.read(key: 'token_expires_at');
    if (expiresAtStr != null) {
      final expiresAt = DateTime.tryParse(expiresAtStr);
      if (expiresAt != null) {
        final now = DateTime.now().toUtc();
        // Refresh if within 60 seconds of expiry
        if (expiresAt.difference(now).inSeconds < 60) {
          return _refreshToken();
        }
      }
    }
    return _storage.read(key: 'access_token');
  }

  /// Refresh the token. Ensures only one refresh is in-flight at a time.
  Future<String?> _refreshToken() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String?>();

    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) {
        _refreshCompleter!.complete(null);
        return null;
      }

      final dio = Dio();
      final response = await dio.post<Map<String, dynamic>>(
        refreshUrl,
        options: Options(contentType: 'application/json'),
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data!;
        final newAccessToken = data['accessToken'] as String;
        final newRefreshToken = data['refreshToken'] as String?;
        final expiresIn = (data['expiresInSeconds'] as num?)?.toInt() ?? 300;

        final expiresAt =
            DateTime.now().toUtc().add(Duration(seconds: expiresIn));

        await _storage.write(key: 'access_token', value: newAccessToken);
        if (newRefreshToken != null) {
          await _storage.write(key: 'refresh_token', value: newRefreshToken);
        }
        await _storage.write(
          key: 'token_expires_at',
          value: expiresAt.toIso8601String(),
        );

        _refreshCompleter!.complete(newAccessToken);
        return newAccessToken;
      }

      _refreshCompleter!.complete(null);
      return null;
    } catch (_) {
      _refreshCompleter!.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }
}
