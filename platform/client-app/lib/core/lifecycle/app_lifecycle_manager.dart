import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/api/sse_client.dart';
import 'package:ohpp_client/core/lifecycle/pending_poller.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/connectivity_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

/// Provider for the SSE client (overrideable for testing).
final sseClientProvider = Provider<SseClient?>((ref) => null);

/// Whether the SSE stream is currently live. Drives the polling fallback:
/// polling only runs while this is false, so SSE (push) is primary and the
/// poll is a safety net when the stream is down.
final sseConnectedProvider = StateProvider<bool>((ref) => false);

/// Provider for the offline queue drain callback.
final offlineQueueDrainProvider = Provider<Future<void> Function()?>((ref) => null);

/// Widget that manages app lifecycle events:
/// - On login: connects SSE, triggers full sync
/// - On SSE event: adds new request to pending provider
/// - On connectivity restore: drains offline queue
/// - On logout: disconnects SSE
/// - On app resume: reconnects SSE if authenticated
class AppLifecycleManager extends ConsumerStatefulWidget {
  final Widget child;

  const AppLifecycleManager({super.key, required this.child});

  @override
  ConsumerState<AppLifecycleManager> createState() => _AppLifecycleManagerState();
}

class _AppLifecycleManagerState extends ConsumerState<AppLifecycleManager>
    with WidgetsBindingObserver {
  bool _sseConnected = false;

  /// Foreground poller: keeps the pending list live even though the SSE push
  /// transport isn't a working stream yet. Started alongside SSE, stopped on
  /// background/logout.
  late final PendingPoller _poller = PendingPoller(
    onRefresh: () {
      if (mounted) ref.read(pendingProvider.notifier).refresh();
    },
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _disconnectSse();
    _poller.stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _onAppResumed();
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        _disconnectSse();
      case AppLifecycleState.detached:
        break;
    }
  }

  void _onAppResumed() {
    final auth = ref.read(authProvider);
    if (auth.state == AuthState.authenticated) {
      _connectSse();
      // Trigger incremental sync via pending refresh
      ref.read(pendingProvider.notifier).refresh();
    }
  }

  void _connectSse() {
    if (_sseConnected) {
      _syncPoller();
      return;
    }
    final sseClient = ref.read(sseClientProvider);
    if (sseClient != null) {
      sseClient.connect();
      _sseConnected = true;
    }
    // Start the backup poller now; it will back off once SSE reports live.
    _syncPoller();
  }

  void _disconnectSse() {
    _poller.stop();
    if (!_sseConnected) return;
    final sseClient = ref.read(sseClientProvider);
    sseClient?.disconnect();
    _sseConnected = false;
  }

  /// Poll only while attached (SSE requested) AND the SSE stream is NOT live.
  /// SSE (push) is primary; the poll is the fallback for when it's down.
  void _syncPoller() {
    final sseLive = ref.read(sseConnectedProvider);
    final authed = ref.read(authProvider).state == AuthState.authenticated;
    if (_sseConnected && authed && !sseLive) {
      _poller.start();
    } else {
      _poller.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    // When SSE goes live, stop polling; when it drops, resume polling.
    ref.listen<bool>(sseConnectedProvider, (previous, next) {
      _syncPoller();
      if (next) {
        // A fresh push connection just came up; reconcile once immediately so
        // anything missed during the gap shows up without waiting for a push.
        ref.read(pendingProvider.notifier).refresh();
      }
    });

    // React to auth state changes
    ref.listen<AuthData>(authProvider, (previous, next) {
      if (next.state == AuthState.authenticated &&
          previous?.state != AuthState.authenticated) {
        // Just logged in: connect SSE
        _connectSse();
      } else if (next.state == AuthState.unauthenticated &&
          previous?.state == AuthState.authenticated) {
        // Logged out: disconnect SSE
        _disconnectSse();
      }
    });

    // React to connectivity changes
    ref.listen<ConnectivityState>(connectivityProvider, (previous, next) {
      if (previous == ConnectivityState.offline &&
          next == ConnectivityState.online) {
        _onConnectivityRestored();
      }
    });

    return widget.child;
  }

  void _onConnectivityRestored() {
    // Drain offline queue
    final drain = ref.read(offlineQueueDrainProvider);
    if (drain != null) {
      drain().then((_) {
        // Update queue badge count
        ref.read(pendingProvider.notifier).updateQueueCount(0);
      });
    }

    // Reconnect SSE if authenticated
    final auth = ref.read(authProvider);
    if (auth.state == AuthState.authenticated) {
      _connectSse();
      ref.read(pendingProvider.notifier).refresh();
    }
  }
}

/// Real SSE connection provider: opens a long-lived HTTP GET to the events
/// endpoint and yields the response body as UTF-8 text chunks. The [SseClient]
/// feeds these chunks to its frame parser.
class HttpSseConnectionProvider implements SseConnectionProvider {
  HttpClient? _client;

  @override
  Stream<String> connect(String url, Map<String, String> headers) async* {
    final client = HttpClient();
    _client = client;
    // No idle timeout: SSE is a long-lived stream (server sends 15s heartbeats).
    client.idleTimeout = const Duration(hours: 1);

    final request = await client.getUrl(Uri.parse(url));
    headers.forEach(request.headers.set);
    request.headers.set(HttpHeaders.acceptHeader, 'text/event-stream');
    // Ask the server not to buffer.
    request.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');

    final response = await request.close();
    if (response.statusCode != 200) {
      client.close(force: true);
      _client = null;
      throw HttpException('SSE connect failed: HTTP ${response.statusCode}');
    }

    // Stream decoded text chunks until the connection ends or is cancelled.
    yield* response.transform(const Utf8Decoder(allowMalformed: true));
  }

  @override
  void disconnect() {
    _client?.close(force: true);
    _client = null;
  }
}
