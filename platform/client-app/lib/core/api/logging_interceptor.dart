import 'package:dio/dio.dart';

import 'package:ohpp_client/core/observability/dev_logger.dart';

/// Dio interceptor that records request / response / error to [DevLog].
///
/// Added after the auth interceptor so it can report which token *type* was
/// attached (device vs identity) without ever logging the token value.
/// No-ops entirely when developer logging is disabled (DevLog.log guards that).
class LoggingInterceptor extends Interceptor {
  final DevLog _log;

  LoggingInterceptor({DevLog? log}) : _log = log ?? DevLog.instance;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final auth = options.headers['Authorization'];
    final tokenKind = _tokenKind(auth is String ? auth : null);
    _log.info(
      'api',
      '→ ${options.method} ${options.uri}',
      detail: 'auth=$tokenKind'
          '${options.data != null ? '\n    body=${_previewBody(options.data)}' : ''}',
    );
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    final req = response.requestOptions;
    _log.info(
      'api',
      '← ${response.statusCode} ${req.method} ${req.uri}',
      detail: 'body=${_previewBody(response.data)}',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final req = err.requestOptions;
    final status = err.response?.statusCode;
    _log.error(
      'api',
      '✗ ${status ?? err.type.name} ${req.method} ${req.uri}',
      detail: [
        'type=${err.type.name}',
        if (err.message != null) 'message=${err.message}',
        if (err.response?.data != null) 'body=${_previewBody(err.response?.data)}',
      ].join('\n    '),
    );
    handler.next(err);
  }

  /// Describe the attached token without revealing it.
  String _tokenKind(String? authHeader) {
    if (authHeader == null || authHeader.isEmpty) return 'none';
    final value = authHeader.replaceFirst(RegExp(r'^Bearer\s+', caseSensitive: false), '');
    if (value.startsWith('ohpp_dev_')) return 'device-token';
    if (value.startsWith('eyJ')) return 'identity-jwt';
    return 'present';
  }

  /// Short, redacted preview of a request/response body.
  String _previewBody(Object? data) {
    if (data == null) return 'null';
    var s = data.toString();
    const max = 500;
    if (s.length > max) s = '${s.substring(0, max)}… (${s.length} chars)';
    return DevLog.redact(s);
  }
}
