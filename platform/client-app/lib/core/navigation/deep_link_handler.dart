/// Handles incoming `ohpp://` deep links for app registration.
/// Queues links if user is not authenticated, processes after login.
class DeepLinkHandler {
  final bool Function() isAuthenticated;
  final void Function(String challengePayload) onProcessChallenge;
  final void Function(String error) onError;

  String? _pendingDeepLink;

  DeepLinkHandler({
    required this.isAuthenticated,
    required this.onProcessChallenge,
    required this.onError,
  });

  /// Handle an incoming URI string.
  void handleDeepLink(String uri) {
    // Only handle ohpp:// scheme
    if (!uri.startsWith('ohpp://')) {
      // Not our scheme, ignore silently
      return;
    }

    final parsed = Uri.tryParse(uri);
    if (parsed == null) {
      onError('Invalid URI format');
      return;
    }

    // Extract challenge parameter
    final challenge = parsed.queryParameters['challenge'];
    if (challenge == null || challenge.isEmpty) {
      onError('Missing challenge parameter');
      return;
    }

    if (!isAuthenticated()) {
      // Queue for processing after login
      _pendingDeepLink = challenge;
      return;
    }

    onProcessChallenge(challenge);
  }

  /// Handle a plain base64url challenge string (from manual paste).
  void handlePlainChallenge(String payload) {
    if (payload.isEmpty) {
      onError('Empty challenge payload');
      return;
    }

    if (!isAuthenticated()) {
      _pendingDeepLink = payload;
      return;
    }

    onProcessChallenge(payload);
  }

  /// Process any queued deep link (called after login completes).
  void processQueuedLink() {
    if (_pendingDeepLink != null) {
      final challenge = _pendingDeepLink!;
      _pendingDeepLink = null;
      onProcessChallenge(challenge);
    }
  }

  /// Whether there's a pending deep link waiting for auth.
  bool get hasPendingLink => _pendingDeepLink != null;
}
