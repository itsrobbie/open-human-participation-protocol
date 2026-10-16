import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/api_exceptions.dart';
import 'package:ohpp_client/core/api/typed_api_client.dart';

void main() {
  late TypedApiClient apiClient;
  late _FakeDio fakeDio;

  setUp(() {
    fakeDio = _FakeDio();
    apiClient = TypedApiClient(dio: fakeDio);
  });

  // --- Happy path ---

  group('Successful responses', () {
    test('getPendingRequests_Returns200_ParsesList', () async {
      fakeDio.responseData = [
        {'requestId': 'req-1', 'appId': 'pizza.test', 'summary': 'Order', 'type': 'select'},
      ];

      final result = await apiClient.getPendingRequests();

      expect(result.length, equals(1));
      expect(result.first['requestId'], equals('req-1'));
    });

    test('submitAttestation_Returns200_Success', () async {
      fakeDio.responseData = {'status': 'ok'};

      // Should not throw
      await apiClient.submitAttestation(
        requestId: 'req-1',
        attestationPayload: '{}',
        deviceSignature: 'sig',
      );
    });

    test('processChallenge_Returns200_ReturnsResult', () async {
      fakeDio.responseData = {'registered': true, 'appName': 'Pizza App'};

      final result = await apiClient.processChallenge('base64payload');

      expect(result['registered'], isTrue);
    });

    test('getRules_Returns200_ParsesList', () async {
      fakeDio.responseData = [
        {'id': 'r1', 'name': 'Rule 1', 'priority': 1},
      ];

      final result = await apiClient.getRules();

      expect(result.length, equals(1));
      expect(result.first['name'], equals('Rule 1'));
    });

    test('createRule_Returns201_ReturnsCreated', () async {
      fakeDio.responseData = {'id': 'r-new', 'name': 'New Rule'};
      fakeDio.statusCode = 201;

      final result = await apiClient.createRule({'name': 'New Rule', 'authLevel': 'biometric'});

      expect(result['id'], equals('r-new'));
    });

    test('getHistory_Returns200_ParsesPaginatedResult', () async {
      fakeDio.responseData = {'items': [], 'totalCount': 0, 'page': 1};

      final result = await apiClient.getHistory(page: 1, pageSize: 20);

      expect(result['totalCount'], equals(0));
    });

    test('getRegisteredApps_Returns200_ParsesList', () async {
      fakeDio.responseData = [
        {'id': 'a1', 'appId': 'bank.test', 'appName': 'Bank'},
      ];

      final result = await apiClient.getRegisteredApps();

      expect(result.first['appName'], equals('Bank'));
    });

    test('registerPushToken_Returns200_Success', () async {
      fakeDio.responseData = {'pushTokenRegistered': true};

      // Should not throw
      await apiClient.registerPushToken('fcm_token_123');
    });
  });

  // --- Non-happy path ---

  group('Error responses', () {
    test('getPendingRequests_401_ThrowsAuthException', () async {
      fakeDio.errorStatusCode = 401;

      expect(
        () => apiClient.getPendingRequests(),
        throwsA(isA<AuthException>()),
      );
    });

    test('submitAttestation_409_ThrowsAlreadyResolvedException', () async {
      fakeDio.errorStatusCode = 409;

      expect(
        () => apiClient.submitAttestation(
          requestId: 'req-1',
          attestationPayload: '{}',
          deviceSignature: 'sig',
        ),
        throwsA(isA<AlreadyResolvedException>()),
      );
    });

    test('submitAttestation_NetworkError_ThrowsConnectivityException', () async {
      fakeDio.throwConnectionError = true;

      expect(
        () => apiClient.submitAttestation(
          requestId: 'req-1',
          attestationPayload: '{}',
          deviceSignature: 'sig',
        ),
        throwsA(isA<ConnectivityException>()),
      );
    });

    test('processChallenge_400_ThrowsValidationException', () async {
      fakeDio.errorStatusCode = 400;

      expect(
        () => apiClient.processChallenge('bad_payload'),
        throwsA(isA<ValidationException>()),
      );
    });

    test('anyCall_500_ThrowsServerException', () async {
      fakeDio.errorStatusCode = 500;

      expect(
        () => apiClient.getRules(),
        throwsA(isA<ServerException>()),
      );
    });

    test('anyCall_Timeout_ThrowsTimeoutException', () async {
      fakeDio.throwTimeout = true;

      expect(
        () => apiClient.getHistory(page: 1, pageSize: 20),
        throwsA(isA<ApiTimeoutException>()),
      );
    });

    test('anyCall_Offline_ThrowsConnectivityException', () async {
      fakeDio.throwConnectionError = true;

      expect(
        () => apiClient.getRegisteredApps(),
        throwsA(isA<ConnectivityException>()),
      );
    });
  });
}

/// Fake Dio that returns configurable responses or throws configurable errors.
class _FakeDio implements DioInterface {
  dynamic responseData;
  int statusCode = 200;
  int? errorStatusCode;
  bool throwConnectionError = false;
  bool throwTimeout = false;

  @override
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters, Options? options}) async {
    return _respond<T>();
  }

  @override
  Future<Response<T>> post<T>(String path, {Object? data, Options? options}) async {
    return _respond<T>();
  }

  @override
  Future<Response<T>> put<T>(String path, {Object? data, Options? options}) async {
    return _respond<T>();
  }

  @override
  Future<Response<T>> delete<T>(String path, {Options? options}) async {
    return _respond<T>();
  }

  Response<T> _respond<T>() {
    if (throwConnectionError) {
      throw DioException(
        type: DioExceptionType.connectionError,
        requestOptions: RequestOptions(path: '/'),
      );
    }
    if (throwTimeout) {
      throw DioException(
        type: DioExceptionType.receiveTimeout,
        requestOptions: RequestOptions(path: '/'),
      );
    }
    if (errorStatusCode != null) {
      throw DioException(
        type: DioExceptionType.badResponse,
        response: Response(
          statusCode: errorStatusCode!,
          requestOptions: RequestOptions(path: '/'),
        ),
        requestOptions: RequestOptions(path: '/'),
      );
    }
    return Response(
      data: responseData as T,
      statusCode: statusCode,
      requestOptions: RequestOptions(path: '/'),
    );
  }
}
