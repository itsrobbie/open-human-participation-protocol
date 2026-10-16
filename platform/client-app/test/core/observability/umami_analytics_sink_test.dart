import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/observability/umami_analytics_sink.dart';

void main() {
  group('UmamiAnalyticsSink', () {
    test('umami_disabledWhenHostMissing', () async {
      final sink = UmamiAnalyticsSink(host: '', websiteId: 'some-uuid');
      expect(sink.isEnabled, isFalse);
      // Disabled capture is a safe no-op (no network, never throws).
      await sink.capture('app_opened');
    });

    test('umami_disabledWhenWebsiteIdMissing', () async {
      final sink = UmamiAnalyticsSink(host: 'http://localhost:8001', websiteId: '');
      expect(sink.isEnabled, isFalse);
      await sink.capture('app_opened');
    });

    test('umami_enabledWhenHostAndWebsiteIdSet', () {
      final sink = UmamiAnalyticsSink(
        host: 'http://localhost:8001',
        websiteId: '0a119000-0b11-4000-8000-000000000002',
      );
      expect(sink.isEnabled, isTrue);
    });

    test('umami_trailingSlashInHostIsTolerated', () {
      // Should not throw / double up the /api/send path when host ends with '/'.
      final sink = UmamiAnalyticsSink(
        host: 'http://localhost:8001/',
        websiteId: '0a119000-0b11-4000-8000-000000000002',
      );
      expect(sink.isEnabled, isTrue);
    });
  });
}
