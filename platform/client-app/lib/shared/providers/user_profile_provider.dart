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

/// Profile screen data: the user map + the real device list (with the current
/// device marked). Overridden in main.dart with a loader bound to the identity
/// API client and the locally-stored device id. The default throws so a missing
/// override is a loud failure, not a silently empty Profile.
typedef ProfileDataLoader = Future<ProfileData> Function();

class ProfileData {
  final Map<String, dynamic> user;
  final List<Map<String, dynamic>> devices;
  const ProfileData({required this.user, required this.devices});
}

final profileDataProvider = FutureProvider.autoDispose<ProfileData>((ref) async {
  final loader = ref.watch(profileDataLoaderProvider);
  return loader();
});

/// The loader is injected at composition root (main.dart / test harness).
final profileDataLoaderProvider = Provider<ProfileDataLoader>((ref) {
  throw UnimplementedError('profileDataLoaderProvider must be overridden');
});
