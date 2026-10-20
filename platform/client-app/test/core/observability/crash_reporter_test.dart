import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/observability/crash_reporter.dart';

/// Recording fake implementing the seam (hand-written, per app convention).
class _RecordingCrashReporter implements CrashReporter {
  final List<({Object error, Map<String, String> context, bool fatal})> calls = [];

  @override
  bool get isEnabled => true;

  @override
  Future<void> recordError(
    Object error,
    StackTrace? stackTrace, {
    Map<String, String> context = const {},
    bool fatal = false,
  }) async {
    // Mirror the real reporter: scrub before storing so tests assert on what
    // would actually be sent.
    calls.add((error: error, context: CrashContextScrubber.scrub(context), fatal: fatal));
  }
}

void main() {
  group('NoopCrashReporter', () {
    test('crashReporter_noopWhenDsnUnset', () async {
      const reporter = NoopCrashReporter();
      expect(reporter.isEnabled, isFalse);
      // Must be a safe no-op.
      await reporter.recordError(Exception('x'), StackTrace.current);
    });
  });

  group('CrashReporter contract', () {
    test('crashReporter_recordError_forwardsToSink', () async {
      final reporter = _RecordingCrashReporter();
      final error = StateError('boom');

      await reporter.recordError(error, StackTrace.current, context: {
        'ohpp.request_id': 'req-9',
      });

      expect(reporter.calls, hasLength(1));
      expect(reporter.calls.single.error, same(error));
      expect(reporter.calls.single.context['ohpp.request_id'], 'req-9');
    });

    test('crashReporter_globalHandlerRoutesErrors', () async {
      // Simulate what main.dart's FlutterError.onError / PlatformDispatcher.onError
      // do: route an error into the reporter.
      final reporter = _RecordingCrashReporter();

      void globalHandler(Object error, StackTrace stack) {
        reporter.recordError(error, stack, context: {'source': 'PlatformDispatcher.onError'});
      }

      globalHandler(ArgumentError('bad'), StackTrace.current);
      // Let the async recordError complete.
      await Future<void>.delayed(Duration.zero);

      expect(reporter.calls, hasLength(1));
      expect(reporter.calls.single.error, isA<ArgumentError>());
    });
  });

  group('CrashContextScrubber (NFR-S1)', () {
    test('crashReporter_scrubsDisallowedFields', () {
      final scrubbed = CrashContextScrubber.scrub({
        'ohpp.request_id': 'req-1',
        'screen': 'pending',
        // Disallowed / sensitive - must be dropped:
        'access_token': 'secret',
        'email': 'a@b.com',
        'attestation_payload': 'xxx',
        'source': 'FlutterError.onError',
      });

      expect(scrubbed['ohpp.request_id'], 'req-1');
      expect(scrubbed['screen'], 'pending');
      expect(scrubbed.containsKey('access_token'), isFalse);
      expect(scrubbed.containsKey('email'), isFalse);
      expect(scrubbed.containsKey('attestation_payload'), isFalse);
      expect(scrubbed.containsKey('source'), isFalse);
    });

    test('drops blank allowed values', () {
      final scrubbed = CrashContextScrubber.scrub({'ohpp.request_id': '   '});
      expect(scrubbed.containsKey('ohpp.request_id'), isFalse);
    });
  });
}
