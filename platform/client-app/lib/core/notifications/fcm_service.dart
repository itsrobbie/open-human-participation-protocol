import 'dart:async';

/// Stub for RemoteMessage when Firebase is not available.
/// Replace with real firebase_messaging import when Firebase is configured.
class RemoteMessage {
  final Map<String, dynamic> data;
  final RemoteNotification? notification;
  RemoteMessage({this.data = const {}, this.notification});
}

class RemoteNotification {
  final String? title;
  final String? body;
  RemoteNotification({this.title, this.body});
}

/// Handles FCM push notification setup, token management, and message routing.
///
/// Currently stubbed - Firebase dependencies are disabled until a Firebase
/// project is configured with GoogleService-Info.plist (iOS) and
/// google-services.json (Android).
///
/// To enable:
/// 1. Create a Firebase project at console.firebase.google.com
/// 2. Add iOS and Android apps
/// 3. Download config files to ios/Runner/ and android/app/
/// 4. Uncomment firebase_* dependencies in pubspec.yaml
/// 5. Replace this stub with the real implementation
class FcmService {
  final Future<void> Function(String token) onTokenRegistered;
  final void Function(RemoteMessage message) onForegroundMessage;
  final void Function(String requestId) onNotificationTap;

  FcmService({
    required this.onTokenRegistered,
    required this.onForegroundMessage,
    required this.onNotificationTap,
  });

  /// Initialize FCM. Currently a no-op (Firebase not configured).
  Future<void> initialize() async {
    // Firebase not configured - push notifications disabled.
    // SSE real-time events and polling are used instead.
  }

  /// Dispose listeners.
  void dispose() {}
}

/// Background message handler placeholder.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op when Firebase is not configured.
}
