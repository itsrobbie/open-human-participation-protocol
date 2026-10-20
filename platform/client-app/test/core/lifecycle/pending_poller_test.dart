import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/core/lifecycle/pending_poller.dart';

/// Bug 1: new requests didn't appear until the app was restarted, because the
/// only refreshes were on construction / resume / manual pull. The SSE
/// transport is a stub that yields nothing, so live updates never arrived.
///
/// A foreground poller makes the list feel live: while running, it re-fetches
/// pending on a fixed interval. These tests pin that behavior deterministically
/// with fake_async (no real waiting).
void main() {
  group('PendingPoller (Bug 1 live updates)', () {
    test('polls on the configured interval while running', () {
      fakeAsync((async) {
        var refreshes = 0;
        final poller = PendingPoller(
          onRefresh: () => refreshes++,
          interval: const Duration(seconds: 10),
        );

        poller.start();
        // start() should not fire an immediate refresh (caller already refreshed).
        expect(refreshes, 0);

        async.elapse(const Duration(seconds: 10));
        expect(refreshes, 1);

        async.elapse(const Duration(seconds: 30));
        expect(refreshes, 4);

        poller.stop();
      });
    });

    test('stop() halts polling', () {
      fakeAsync((async) {
        var refreshes = 0;
        final poller = PendingPoller(
          onRefresh: () => refreshes++,
          interval: const Duration(seconds: 5),
        );

        poller.start();
        async.elapse(const Duration(seconds: 5));
        expect(refreshes, 1);

        poller.stop();
        async.elapse(const Duration(seconds: 60));
        expect(refreshes, 1, reason: 'no polling after stop()');
      });
    });

    test('start() is idempotent (no double timers)', () {
      fakeAsync((async) {
        var refreshes = 0;
        final poller = PendingPoller(
          onRefresh: () => refreshes++,
          interval: const Duration(seconds: 5),
        );

        poller.start();
        poller.start(); // second call must not create a second timer
        async.elapse(const Duration(seconds: 5));
        expect(refreshes, 1, reason: 'a double start must not double the polls');

        poller.stop();
      });
    });
  });
}
