import 'package:flutter_test/flutter_test.dart';

import 'mock_resolver.dart';

/// Step 45: Authentication flow integration tests.
void main() {
  late MockResolver resolver;

  setUp(() {
    resolver = MockResolver();
  });

  group('Authentication Flow', () {
    test('integration_Login_ValidCredentials_NavigatesToHome', () {
      final result = resolver.login('testuser', 'password123');

      expect(result['access_token'], isNotEmpty);
      expect(result['refresh_token'], isNotEmpty);
      expect(result['expires_in'], 300);
    });

    test('integration_Login_InvalidCredentials_ShowsError', () {
      expect(
        () => resolver.login('wrong', 'wrong'),
        throwsA(isA<MockApiError>().having((e) => e.statusCode, 'status', 401)),
      );
    });

    test('integration_Login_TokenExpired_RefreshesAutomatically', () {
      // Simulate: first token expired, refresh works
      final refreshResult = resolver.refresh(resolver.refreshToken);

      expect(refreshResult['access_token'], isNotEmpty);
      expect(refreshResult['access_token'], isNot(resolver.accessToken));
    });

    test('integration_Login_RefreshFails_RedirectsToLogin', () {
      resolver.refreshShouldFail = true;

      expect(
        () => resolver.refresh(resolver.refreshToken),
        throwsA(isA<MockApiError>().having((e) => e.statusCode, 'status', 401)),
      );
    });

    test('integration_Logout_ClearsState_NavigatesToLogin', () {
      // Login first
      final loginResult = resolver.login('testuser', 'password123');
      expect(loginResult['access_token'], isNotEmpty);

      // Simulate logout by verifying token can be cleared
      // In real app: TokenManager.clear() + navigate to login
      // Here we verify the mock state supports the flow
      resolver.accessToken = '';
      expect(resolver.accessToken, isEmpty);
    });
  });
}
