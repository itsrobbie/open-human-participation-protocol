import 'package:dio/dio.dart';

import 'auth_interceptor.dart';
import 'timeout_config.dart';

/// Typed HTTP client for all Resolver API communication.
/// Handles token injection, refresh, cert pinning, retries, and timeouts.
class ResolverApiClient {
  late final Dio _dio;
  final String baseUrl;
  final AuthInterceptor _authInterceptor;

  ResolverApiClient({
    required this.baseUrl,
    required AuthInterceptor authInterceptor,
  }) : _authInterceptor = authInterceptor {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: TimeoutConfig.defaultConnect,
      receiveTimeout: TimeoutConfig.defaultRead,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.add(_authInterceptor);
    _dio.interceptors.add(RetryInterceptor(dio: _dio));
  }

  /// GET with configurable timeout (uses polling timeouts by default).
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Duration? connectTimeout,
    Duration? receiveTimeout,
  }) {
    return _dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: Options(
        sendTimeout: connectTimeout ?? TimeoutConfig.pollingConnect,
        receiveTimeout: receiveTimeout ?? TimeoutConfig.pollingRead,
      ),
    );
  }

  /// POST with submission timeouts.
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Duration? connectTimeout,
    Duration? receiveTimeout,
  }) {
    return _dio.post<T>(
      path,
      data: data,
      options: Options(
        sendTimeout: connectTimeout ?? TimeoutConfig.submissionConnect,
        receiveTimeout: receiveTimeout ?? TimeoutConfig.submissionRead,
      ),
    );
  }

  /// PUT with submission timeouts.
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
  }) {
    return _dio.put<T>(
      path,
      data: data,
      options: Options(
        sendTimeout: TimeoutConfig.submissionConnect,
        receiveTimeout: TimeoutConfig.submissionRead,
      ),
    );
  }

  /// DELETE with submission timeouts.
  Future<Response<T>> delete<T>(String path) {
    return _dio.delete<T>(
      path,
      options: Options(
        sendTimeout: TimeoutConfig.submissionConnect,
        receiveTimeout: TimeoutConfig.submissionRead,
      ),
    );
  }
}

/// Retry interceptor with exponential backoff on 5xx and timeouts.
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;

  RetryInterceptor({required this.dio, this.maxRetries = 3});

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final shouldRetry = _shouldRetry(err);
    final attempts = (err.requestOptions.extra['retryCount'] as int?) ?? 0;

    if (shouldRetry && attempts < maxRetries) {
      final nextAttempt = attempts + 1;
      final delay = Duration(milliseconds: _backoffMs(nextAttempt));

      await Future<void>.delayed(delay);

      err.requestOptions.extra['retryCount'] = nextAttempt;

      try {
        final response = await dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } on DioException catch (retryErr) {
        handler.next(retryErr);
        return;
      }
    }

    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout) {
      return true;
    }

    final statusCode = err.response?.statusCode;
    if (statusCode != null && statusCode >= 500) {
      return true;
    }

    return false;
  }

  /// Exponential backoff: 1000ms, 3000ms, 9000ms
  int _backoffMs(int attempt) {
    return 1000 * _pow(3, attempt - 1);
  }

  int _pow(int base, int exp) {
    var result = 1;
    for (var i = 0; i < exp; i++) {
      result *= base;
    }
    return result;
  }
}
