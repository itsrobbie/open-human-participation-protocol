import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/observability/analytics_sink.dart';

/// Recording fake implementing the seam (scrubs like the real sink).
class _RecordingAnalyticsSink implements AnalyticsSink {
  final List<({String event, Map<String, Object> props})> events = [];

  @override
  bool get isEnabled => true;

  @override
  Future<void> capture(String event, {Map<String, Object> properties = const {}}) async {
    events.add((event: event, props: AnalyticsPropertyScrubber.scrub(properties)));
  }
}

void main() {
  group('NoopAnalyticsSink', () {
    test('analytics_noopWhenUnconfigured', () async {
      const sink = NoopAnalyticsSink();
      expect(sink.isEnabled, isFalse);
      await sink.capture(AnalyticsEvent.appOpened);
    });
  });

  group('AnalyticsSink contract', () {
    test('analytics_capture_forwardsEventAndProps', () async {
      final sink = _RecordingAnalyticsSink();

      await sink.capture(AnalyticsEvent.requestResponded, properties: {
        'request_type': 'select',
        'decision': 'approve',
      });

      expect(sink.events, hasLength(1));
      expect(sink.events.single.event, 'request_responded');
      expect(sink.events.single.props['request_type'], 'select');
      expect(sink.events.single.props['decision'], 'approve');
    });

    test('analytics_taxonomyEvents_areTheSharedMinimalSet', () {
      // The client emits exactly this minimal shared taxonomy (Q4).
      expect(AnalyticsEvent.appOpened, 'app_opened');
      expect(AnalyticsEvent.requestReceived, 'request_received');
      expect(AnalyticsEvent.requestResponded, 'request_responded');
      expect(AnalyticsEvent.requestExpired, 'request_expired');
      expect(AnalyticsEvent.errorShown, 'error_shown');
    });
  });

  group('AnalyticsPropertyScrubber (NFR-S1)', () {
    test('analytics_noPiiInProperties', () {
      final scrubbed = AnalyticsPropertyScrubber.scrub({
        'request_type': 'signature',
        'category': 'orders',
        // Disallowed / PII - must be dropped:
        'email': 'a@b.com',
        'user_id': 'u-1',
        'access_token': 'secret',
        'summary': 'Confirm pizza order for Jane Doe',
      });

      expect(scrubbed['request_type'], 'signature');
      expect(scrubbed['category'], 'orders');
      expect(scrubbed.containsKey('email'), isFalse);
      expect(scrubbed.containsKey('user_id'), isFalse);
      expect(scrubbed.containsKey('access_token'), isFalse);
      expect(scrubbed.containsKey('summary'), isFalse);
    });
  });
}
