import 'dart:async';

/// Foreground poller that periodically triggers a pending-list refresh so new
/// requests appear without restarting the app.
///
/// This is the reliable "live" mechanism: the SSE push path exists but its
/// transport is not yet a working stream, so a foreground interval poll keeps
/// the list current. It is started when the app is authenticated and in the
/// foreground, and stopped on background/logout so it never polls needlessly.
class PendingPoller {
  final void Function() onRefresh;
  final Duration interval;

  Timer? _timer;

  PendingPoller({
    required this.onRefresh,
    this.interval = const Duration(seconds: 15),
  });

  bool get isRunning => _timer != null;

  /// Begin polling. Does NOT fire an immediate refresh (callers typically
  /// refresh once themselves on foreground/login). Idempotent: calling start()
  /// while already running is a no-op (no duplicate timers).
  void start() {
    if (_timer != null) return;
    _timer = Timer.periodic(interval, (_) => onRefresh());
  }

  /// Stop polling.
  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
