import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/core/lifecycle/pending_poller.dart';

/// SSE is the PRIMARY live transport; the poll is a BACKUP that must only run
/// while SSE is not live. This pins that coordination rule end to end against
/// the real PendingPoller (the rule mirrors AppLifecycleManager._syncPoller:
/// poll iff attached AND authenticated AND NOT sseLive).
void main() {
  // The exact predicate AppLifecycleManager uses to decide whether to poll.
  bool shouldPoll({
    required bool attached,
    required bool authenticated,
    required bool sseLive,
  }) =>
      attached && authenticated && !sseLive;

  void sync(
    PendingPoller poller, {
    required bool attached,
    required bool authenticated,
    required bool sseLive,
  }) {
    if (shouldPoll(
        attached: attached, authenticated: authenticated, sseLive: sseLive)) {
      poller.start();
    } else {
      poller.stop();
    }
  }

  test('poll rule: only when attached + authenticated + SSE not live', () {
    expect(shouldPoll(attached: true, authenticated: true, sseLive: false), isTrue);
    // SSE live => no polling (push is primary).
    expect(shouldPoll(attached: true, authenticated: true, sseLive: true), isFalse);
    // Not authenticated / detached => never poll.
    expect(shouldPoll(attached: false, authenticated: true, sseLive: false), isFalse);
    expect(shouldPoll(attached: true, authenticated: false, sseLive: false), isFalse);
  });

  test('poller runs while SSE down, then stops when SSE comes live', () {
    fakeAsync((async) {
      var refreshes = 0;
      final poller = PendingPoller(
        onRefresh: () => refreshes++,
        interval: const Duration(seconds: 10),
      );

      // Attached + authed, SSE not yet live -> backup polling active.
      sync(poller, attached: true, authenticated: true, sseLive: false);
      async.elapse(const Duration(seconds: 30));
      expect(refreshes, 3);

      // SSE becomes live -> polling backs off.
      sync(poller, attached: true, authenticated: true, sseLive: true);
      async.elapse(const Duration(seconds: 60));
      expect(refreshes, 3, reason: 'no polling while SSE is the live transport');

      // SSE drops -> polling resumes as the fallback.
      sync(poller, attached: true, authenticated: true, sseLive: false);
      async.elapse(const Duration(seconds: 20));
      expect(refreshes, 5);

      poller.stop();
    });
  });
}
