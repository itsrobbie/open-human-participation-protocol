import 'dart:async';

/// Interface for secure token storage.
abstract class TokenStore {
  Future<String?> getAccessToken();
  Future<String?> getRefreshToken();
  Future<DateTime?> getExpiresAt();
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
  });
  Future<void> clearTokens();
}

/// Interface for refreshing tokens via Keycloak.
abstract class TokenRefresher {
  Future<TokenRefreshResult?> refresh(String refreshToken);
}

/// Result of a successful token refresh.
class TokenRefreshResult {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  const TokenRefreshResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });
}

/// Manages access token lifecycle: expiry checking, proactive refresh,
/// and concurrency-safe single-refresh-in-flight guarantee.
class TokenManager {
  final TokenStore _store;
  final TokenRefresher _refresher;
  final void Function() onSessionExpired;

  /// Refresh window: refresh if token expires within this duration.
  static const _refreshWindow = Duration(seconds: 60);

  Completer<String?>? _refreshCompleter;

  TokenManager({
    required TokenStore store,
    required TokenRefresher refresher,
    required this.onSessionExpired,
  })  : _store = store,
        _refresher = refresher;

  /// Get a valid access token. Triggers refresh if expiring soon or expired.
  /// Returns null if no token available and refresh fails.
  Future<String?> getToken() async {
    final accessToken = await _store.getAccessToken();
    if (accessToken == null) return null;

    final expiresAt = await _store.getExpiresAt();
    if (expiresAt == null) return null;

    final now = DateTime.now().toUtc();
    final timeUntilExpiry = expiresAt.difference(now);

    // Token is fresh enough
    if (timeUntilExpiry > _refreshWindow) {
      return accessToken;
    }

    // Token is expiring or expired - refresh
    return _doRefresh();
  }

  /// Perform refresh with single-in-flight guarantee.
  Future<String?> _doRefresh() async {
    // If a refresh is already in progress, wait for it
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String?>();

    try {
      final refreshToken = await _store.getRefreshToken();
      if (refreshToken == null) {
        onSessionExpired();
        _refreshCompleter!.complete(null);
        return null;
      }

      final result = await _refresher.refresh(refreshToken);

      if (result == null) {
        onSessionExpired();
        _refreshCompleter!.complete(null);
        return null;
      }

      final newExpiresAt = DateTime.now().toUtc().add(Duration(seconds: result.expiresIn));
      await _store.saveTokens(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: newExpiresAt,
      );

      _refreshCompleter!.complete(result.accessToken);
      return result.accessToken;
    } catch (_) {
      onSessionExpired();
      _refreshCompleter!.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }
}
