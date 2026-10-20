import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Connectivity state.
enum ConnectivityState { online, offline }

/// Provides real-time connectivity status.
/// Wraps connectivity_plus stream.
class ConnectivityNotifier extends StateNotifier<ConnectivityState> {
  StreamSubscription<ConnectivityState>? _subscription;

  ConnectivityNotifier({Stream<ConnectivityState>? stream})
      : super(ConnectivityState.online) {
    _subscription = stream?.listen((s) => state = s);
  }

  void setOnline() => state = ConnectivityState.online;
  void setOffline() => state = ConnectivityState.offline;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

final connectivityProvider =
    StateNotifierProvider<ConnectivityNotifier, ConnectivityState>((ref) {
  return ConnectivityNotifier();
});
