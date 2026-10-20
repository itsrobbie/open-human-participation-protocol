import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/navigation/deep_link_handler.dart';

void main() {
  late DeepLinkHandler handler;
  late bool authenticated;
  late String? processedChallenge;
  late String? lastError;

  setUp(() {
    authenticated = true;
    processedChallenge = null;
    lastError = null;
    handler = DeepLinkHandler(
      isAuthenticated: () => authenticated,
      onProcessChallenge: (c) => processedChallenge = c,
      onError: (e) => lastError = e,
    );
  });

  // --- Happy path ---

  group('handleDeepLink - authenticated', () {
    test('handleDeepLink_ValidUri_NavigatesToRegistration', () {
      handler.handleDeepLink('ohpp://register?challenge=abc123');

      expect(processedChallenge, equals('abc123'));
      expect(lastError, isNull);
    });

    test('handleDeepLink_Authenticated_ProcessesImmediately', () {
      authenticated = true;

      handler.handleDeepLink('ohpp://register?challenge=immediate');

      expect(processedChallenge, equals('immediate'));
    });

    test('handleDeepLink_PlainBase64_AlsoAccepted', () {
      handler.handlePlainChallenge('base64url_challenge_data');

      expect(processedChallenge, equals('base64url_challenge_data'));
    });
  });

  // --- Non-happy path ---

  group('handleDeepLink - not authenticated', () {
    test('handleDeepLink_NotAuthenticated_QueuesForLater', () {
      authenticated = false;

      handler.handleDeepLink('ohpp://register?challenge=queued');

      expect(processedChallenge, isNull);
      expect(handler.hasPendingLink, isTrue);
    });

    test('handleDeepLink_AfterLogin_ProcessesQueued', () {
      authenticated = false;
      handler.handleDeepLink('ohpp://register?challenge=deferred');

      expect(processedChallenge, isNull);

      // Simulate login
      authenticated = true;
      handler.processQueuedLink();

      expect(processedChallenge, equals('deferred'));
      expect(handler.hasPendingLink, isFalse);
    });
  });

  group('handleDeepLink - errors', () {
    test('handleDeepLink_InvalidScheme_Ignored', () {
      handler.handleDeepLink('https://example.com/something');

      expect(processedChallenge, isNull);
      expect(lastError, isNull); // Silently ignored
    });

    test('handleDeepLink_MissingChallenge_ShowsError', () {
      handler.handleDeepLink('ohpp://register?other=value');

      expect(processedChallenge, isNull);
      expect(lastError, contains('Missing challenge'));
    });

    test('handleDeepLink_EmptyChallenge_ShowsError', () {
      handler.handleDeepLink('ohpp://register?challenge=');

      expect(processedChallenge, isNull);
      expect(lastError, contains('Missing challenge'));
    });
  });
}
