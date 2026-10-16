import 'dart:async';

import 'package:ohpp_client/core/api/sse_frame_parser.dart';
import 'package:ohpp_client/core/observability/dev_logger.dart';

/// Parsed SSE event from the Resolver.
class SseEvent {
  final String type;
  final Map<String, dynamic> data;

  const SseEvent({required this.type, required this.data});
}

/// Interface for SSE connection (allows faking in tests).
abstract class SseConnectionProvider {
  Stream<String> connect(String url, Map<String, String> headers);
  void disconnect();
}

/// Client for Server-Sent Events from the Resolver.
/// Maintains a foreground-only connection with automatic reconnection.
class SseClient {
  final SseConnectionProvider _connectionProvider;
  final String baseUrl;

  /// Resolves the auth token for the stream. The events endpoint requires the
  /// DEVICE token, which lives in secure storage, so this is async.
  final Future<String?> Function() getAuthToken;
  final void Function(SseEvent event) onEvent;
  final void Function()? onAuthExpired;

  /// Notified whenever the connection state changes (connected/disconnected),
  /// so a polling fallback can back off while SSE is healthy.
  final void Function(bool connected)? onConnectionStateChanged;

  final SseFrameParser _parser = SseFrameParser();

  StreamSubscription<String>? _subscription;
  bool _connected = false;
  bool _streamLive = false;
  int _reconnectAttempts = 0;
  static const _maxReconnectDelay = Duration(seconds: 30);

  SseClient({
    required this.baseUrl,
    required this.getAuthToken,
    required this.onEvent,
    required SseConnectionProvider connectionProvider,
    this.onAuthExpired,
    this.onConnectionStateChanged,
  }) : _connectionProvider = connectionProvider;

  void _setStreamLive(bool live) {
    if (_streamLive == live) return;
    _streamLive = live;
    onConnectionStateChanged?.call(live);
  }

  /// Connect to SSE stream (foreground only).
  void connect() {
    if (_connected) return;
    _connected = true;
    _reconnectAttempts = 0;
    _startConnection();
  }

  /// Disconnect from SSE stream (app backgrounded).
  void disconnect() {
    _connected = false;
    _subscription?.cancel();
    _subscription = null;
    _connectionProvider.disconnect();
    _setStreamLive(false);
  }

  /// Whether the client is currently connected.
  bool get isConnected => _connected && _subscription != null;

  Future<void> _startConnection() async {
    if (!_connected) return;

    final token = await getAuthToken();
    if (!_connected) return; // disconnected while awaiting the token
    final hasToken = token != null && token.isNotEmpty;
    DevLog.instance.info('sse',
        '→ connecting to $baseUrl/api/devices/me/events (auth=${hasToken ? 'present' : 'NONE'})');
    if (!hasToken) {
      DevLog.instance.warning('sse',
          'No auth token for SSE; server will 401. Live push disabled (poll fallback covers it).');
    }
    _parser.addChunk(''); // ensure a clean parser state per connection

    final stream = _connectionProvider.connect(
      '$baseUrl/api/devices/me/events',
      {'Authorization': 'Bearer ${token ?? ''}'},
    );

    _subscription = stream.listen(
      (chunk) {
        _setStreamLive(true);
        _handleChunk(chunk);
      },
      onError: (Object error) {
        DevLog.instance.error('sse', 'Stream error', detail: error.toString());
        _handleDisconnect();
      },
      onDone: () {
        DevLog.instance.info('sse', 'Stream closed');
        _handleDisconnect();
      },
    );
  }

  /// Feed a raw stream chunk through the SSE frame parser and dispatch any
  /// complete frames as typed [SseEvent]s.
  void _handleChunk(String chunk) {
    _parser.addChunk(chunk);
    for (final frame in _parser.drain()) {
      _reconnectAttempts = 0; // a real frame proves the connection is healthy
      DevLog.instance.debug('sse', 'event: ${frame.event}');
      onEvent(SseEvent(type: frame.event, data: frame.data));
    }
  }

  void _handleDisconnect() {
    _subscription?.cancel();
    _subscription = null;
    _setStreamLive(false); // stream dropped -> poll fallback resumes

    if (!_connected) return; // Intentional disconnect

    // Reconnect with exponential backoff
    _reconnectAttempts++;
    final delay = _calculateBackoff();

    if (delay > _maxReconnectDelay) {
      // Too many failures, stop trying (will reconnect on next app resume)
      _connected = false;
      return;
    }

    Future.delayed(delay, () {
      if (_connected) _startConnection();
    });
  }

  Duration _calculateBackoff() {
    // 1s, 2s, 4s, 8s, 16s, 30s (capped)
    final seconds = (1 << _reconnectAttempts).clamp(1, 30);
    return Duration(seconds: seconds);
  }
}
