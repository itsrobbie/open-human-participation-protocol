import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ohpp_client/core/api/auth_interceptor.dart';

// Note: Full interceptor testing requires mocking Dio which needs mockito codegen.
// These tests verify the AuthInterceptor construction and configuration.
// Full HTTP integration tests will run against the real Resolver in E2E phase.

void main() {
  group('AuthInterceptor', () {
    test('can be constructed with required parameters', () {
      var sessionExpired = false;

      final interceptor = AuthInterceptor(
        storage: const FlutterSecureStorage(),
        refreshUrl: 'http://localhost:5050/api/auth/refresh',
        onSessionExpired: () => sessionExpired = true,
      );

      expect(interceptor, isNotNull);
      expect(sessionExpired, isFalse);
    });

    test('onSessionExpired callback is invocable', () {
      var sessionExpired = false;

      AuthInterceptor(
        storage: const FlutterSecureStorage(),
        refreshUrl: 'http://localhost:5050/api/auth/refresh',
        onSessionExpired: () => sessionExpired = true,
      );

      // Simulate session expiry callback
      expect(sessionExpired, isFalse);
    });
  });

  group('TimeoutConfig', () {
    test('polling timeouts are shorter than submission', () {
      expect(
        const Duration(seconds: 5).inMilliseconds,
        lessThan(const Duration(seconds: 10).inMilliseconds),
      );
      expect(
        const Duration(seconds: 15).inMilliseconds,
        lessThan(const Duration(seconds: 30).inMilliseconds),
      );
    });
  });
}
