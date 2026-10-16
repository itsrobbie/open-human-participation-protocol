import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/auth_interceptor.dart';
import 'package:ohpp_client/core/api/resolver_api_client.dart';

void main() {
  group('RetryInterceptor', () {
    test('can be constructed with default max retries', () {
      final dio = Dio();
      final interceptor = RetryInterceptor(dio: dio);

      expect(interceptor, isNotNull);
      expect(interceptor.maxRetries, equals(3));
    });

    test('can be constructed with custom max retries', () {
      final dio = Dio();
      final interceptor = RetryInterceptor(dio: dio, maxRetries: 5);

      expect(interceptor.maxRetries, equals(5));
    });
  });

  group('ResolverApiClient', () {
    test('configures base URL correctly', () {
      // Verify construction doesn't throw
      // (actual HTTP calls tested in integration tests)
      expect(
        () => ResolverApiClient(
          baseUrl: 'http://localhost:5000',
          authInterceptor: AuthInterceptor(
            storage: const FlutterSecureStorage(),
            keycloakTokenUrl: 'http://localhost:8080/token',
            clientId: 'ohpp-test',
            onSessionExpired: () {},
          ),
        ),
        returnsNormally,
      );
    });
  });
}
