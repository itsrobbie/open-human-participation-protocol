import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_provider.dart';

/// User profile data from the Resolver.
class UserProfile {
  final String userId;
  final String displayName;
  final String? email;
  final String resolverBaseUrl;

  const UserProfile({
    required this.userId,
    required this.displayName,
    this.email,
    required this.resolverBaseUrl,
  });
}

/// Interface for fetching user profile.
abstract class ProfileDataSource {
  Future<UserProfile?> fetchProfile();
}

/// Provides the current user's profile (null when unauthenticated).
final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final auth = ref.watch(authProvider);
  if (auth.state != AuthState.authenticated) return null;

  // In real app, this calls the Resolver API
  // For now, return placeholder based on auth data
  return UserProfile(
    userId: auth.userId ?? '',
    displayName: 'User',
    resolverBaseUrl: 'http://localhost:5050',
  );
});
