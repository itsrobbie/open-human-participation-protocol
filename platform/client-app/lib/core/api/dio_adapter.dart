import 'package:dio/dio.dart';

import 'typed_api_client.dart';

/// Adapts a real [Dio] instance to the [DioInterface] used by [TypedApiClient].
class DioAdapter implements DioInterface {
  final Dio _dio;

  DioAdapter(this._dio);

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters, options: options);

  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Options? options,
  }) =>
      _dio.post<T>(path, data: data, options: options);

  @override
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Options? options,
  }) =>
      _dio.put<T>(path, data: data, options: options);

  @override
  Future<Response<T>> delete<T>(
    String path, {
    Options? options,
  }) =>
      _dio.delete<T>(path, options: options);
}
