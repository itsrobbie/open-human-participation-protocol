import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/auth/token_manager.dart';

void main() {
  late TokenManager manager;
  late _FakeTokenStore store;
  late _FakeTokenRefresher refresher;
  late bool logoutCalled;

  setUp(() {
    store = _FakeTokenStore();
    refresher = _FakeTokenRefresher();
    logoutCalled = false;
    manager = TokenManager(
      store: store,
      refresher: refresher,
      onSessionExpired: () => logoutCalled = true,
    );
  });

  // --- Happy path ---

  group('getToken - valid token', () {
    test('getToken_NotExpired_ReturnsCurrent', () async {
      store.accessToken = 'valid_token';
      store.expiresAt = DateTime.now().toUtc().add(const Duration(minutes: 5));

      final token = await manager.getToken();

      expect(token, equals('valid_token'));
      expect(refresher.refreshCount, equals(0));
    });

    test('getToken_Within60sOfExpiry_TriggersRefresh', () async {
      store.accessToken = 'old_token';
      store.expiresAt = DateTime.now().toUtc().add(const Duration(seconds: 30));
      refresher.newAccessToken = 'new_token';
      refresher.newExpiresIn = 3600;

      final token = await manager.getToken();

      expect(token, equals('new_token'));
      expect(refresher.refreshCount, equals(1));
    });

    test('getToken_AfterRefresh_ReturnsNewToken', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().add(const Duration(seconds: 10));
      refresher.newAccessToken = 'fresh';
      refresher.newExpiresIn = 3600;

      final token = await manager.getToken();

      expect(token, equals('fresh'));
      expect(store.accessToken, equals('fresh'));
    });

    test('refresh_Success_StoresNewTokens', () async {
      store.accessToken = 'old';
      store.refreshToken = 'refresh_abc';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.newAccessToken = 'new_access';
      refresher.newRefreshToken = 'new_refresh';
      refresher.newExpiresIn = 7200;

      await manager.getToken();

      expect(store.accessToken, equals('new_access'));
      expect(store.refreshToken, equals('new_refresh'));
    });

    test('refresh_UpdatesExpiryTimestamp', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.newAccessToken = 'new';
      refresher.newExpiresIn = 3600;

      await manager.getToken();

      // New expiry should be ~1 hour from now
      expect(
        store.expiresAt!.isAfter(DateTime.now().toUtc().add(const Duration(minutes: 59))),
        isTrue,
      );
    });
  });

  // --- Non-happy path ---

  group('getToken - failures', () {
    test('getToken_Expired_TriggersRefresh', () async {
      store.accessToken = 'expired';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(minutes: 5));
      refresher.newAccessToken = 'refreshed';
      refresher.newExpiresIn = 3600;

      final token = await manager.getToken();

      expect(token, equals('refreshed'));
      expect(refresher.refreshCount, equals(1));
    });

    test('refresh_Failure401_EmitsLogoutEvent', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.shouldFail = true;

      final token = await manager.getToken();

      expect(token, isNull);
      expect(logoutCalled, isTrue);
    });

    test('refresh_NetworkError_EmitsLogoutEvent', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.shouldThrow = true;

      final token = await manager.getToken();

      expect(token, isNull);
      expect(logoutCalled, isTrue);
    });

    test('refresh_ConcurrentCalls_OnlyOneRefreshExecuted', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.newAccessToken = 'concurrent_result';
      refresher.newExpiresIn = 3600;
      refresher.delay = const Duration(milliseconds: 50);

      // Fire two concurrent getToken calls
      final futures = [manager.getToken(), manager.getToken()];
      final results = await Future.wait(futures);

      // Both should get the same token
      expect(results[0], equals('concurrent_result'));
      expect(results[1], equals('concurrent_result'));
      // But only one refresh should have executed
      expect(refresher.refreshCount, equals(1));
    });

    test('refresh_ConcurrentCalls_AllCallersGetNewToken', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      refresher.newAccessToken = 'shared_token';
      refresher.newExpiresIn = 3600;
      refresher.delay = const Duration(milliseconds: 30);

      final results = await Future.wait([
        manager.getToken(),
        manager.getToken(),
        manager.getToken(),
      ]);

      for (final token in results) {
        expect(token, equals('shared_token'));
      }
    });
  });

  group('getToken - no tokens', () {
    test('getToken_NoStoredToken_ReturnsNull', () async {
      store.accessToken = null;
      store.expiresAt = null;

      final token = await manager.getToken();

      expect(token, isNull);
    });

    test('getToken_NoRefreshToken_EmitsLogout', () async {
      store.accessToken = 'old';
      store.expiresAt = DateTime.now().toUtc().subtract(const Duration(seconds: 1));
      store.refreshToken = null;

      final token = await manager.getToken();

      expect(token, isNull);
      expect(logoutCalled, isTrue);
    });
  });
}

/// Fake token store (replaces flutter_secure_storage in tests).
class _FakeTokenStore implements TokenStore {
  String? accessToken;
  String? refreshToken = 'refresh_token_default';
  DateTime? expiresAt;

  @override
  Future<String?> getAccessToken() async => accessToken;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<DateTime?> getExpiresAt() async => expiresAt;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
  }) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
  }

  @override
  Future<void> clearTokens() async {
    accessToken = null;
    refreshToken = null;
    expiresAt = null;
  }
}

/// Fake token refresher (replaces Keycloak HTTP call in tests).
class _FakeTokenRefresher implements TokenRefresher {
  String newAccessToken = 'refreshed_token';
  String newRefreshToken = 'new_refresh_token';
  int newExpiresIn = 3600;
  bool shouldFail = false;
  bool shouldThrow = false;
  int refreshCount = 0;
  Duration delay = Duration.zero;

  @override
  Future<TokenRefreshResult?> refresh(String refreshToken) async {
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    refreshCount++;

    if (shouldThrow) throw Exception('Network error');
    if (shouldFail) return null;

    return TokenRefreshResult(
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: newExpiresIn,
    );
  }
}
