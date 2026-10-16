import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Authentication state.
enum AuthState {
  unauthenticated,
  authenticated,
  loading,
}

/// Auth state with user info.
class AuthData {
  final AuthState state;
  final String? userId;
  final String? accessToken;

  const AuthData({
    this.state = AuthState.unauthenticated,
    this.userId,
    this.accessToken,
  });

  AuthData copyWith({AuthState? state, String? userId, String? accessToken}) {
    return AuthData(
      state: state ?? this.state,
      userId: userId ?? this.userId,
      accessToken: accessToken ?? this.accessToken,
    );
  }
}

/// Manages authentication state (login, logout, token refresh).
class AuthNotifier extends StateNotifier<AuthData> {
  AuthNotifier() : super(const AuthData());

  void login({required String userId, required String accessToken}) {
    state = AuthData(
      state: AuthState.authenticated,
      userId: userId,
      accessToken: accessToken,
    );
  }

  void logout() {
    state = const AuthData(state: AuthState.unauthenticated);
  }

  void refreshToken(String newToken) {
    state = state.copyWith(accessToken: newToken);
  }

  bool get isAuthenticated => state.state == AuthState.authenticated;
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthData>((ref) {
  return AuthNotifier();
});
