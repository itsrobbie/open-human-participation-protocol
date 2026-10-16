import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/sse_client.dart';

void main() {
  late SseClient client;
  late _FakeConnectionProvider provider;
  late List<SseEvent> receivedEvents;
  late List<bool> connectionStates;

  setUp(() {
    provider = _FakeConnectionProvider();
    receivedEvents = [];
    connectionStates = [];
    client = SseClient(
      baseUrl: 'http://localhost:5000',
      getAuthToken: () async => 'device_token',
      onEvent: (event) => receivedEvents.add(event),
      connectionProvider: provider,
      onConnectionStateChanged: connectionStates.add,
    );
  });

  tearDown(() {
    client.disconnect();
  });

  group('Connection', () {
    test('connect establishes the stream with the device token', () async {
      client.connect();
      await Future<void>.delayed(Duration.zero); // await the async token

      expect(provider.connected, isTrue);
      expect(provider.lastUrl,
          equals('http://localhost:5000/api/devices/me/events'));
      expect(provider.lastHeaders?['Authorization'], equals('Bearer device_token'));
    });

    test('a new_request frame is parsed into a typed event with JSON data',
        () async {
      client.connect();
      await Future<void>.delayed(Duration.zero);

      provider.emit('event: new_request\n'
          'data: {"requestId":"req-1","appId":"pizza.test"}\n\n');
      await Future<void>.delayed(Duration.zero);

      expect(receivedEvents, hasLength(1));
      expect(receivedEvents.single.type, 'new_request');
      expect(receivedEvents.single.data['requestId'], 'req-1');
      expect(receivedEvents.single.data['appId'], 'pizza.test');
    });

    test('multiple frames each emit an event', () async {
      client.connect();
      await Future<void>.delayed(Duration.zero);

      provider.emit('event: new_request\ndata: {"requestId":"r1"}\n\n'
          'event: request_expired\ndata: {"requestId":"r2","status":"Expired"}\n\n');
      await Future<void>.delayed(Duration.zero);

      expect(receivedEvents, hasLength(2));
      expect(receivedEvents[0].type, 'new_request');
      expect(receivedEvents[1].type, 'request_expired');
    });

    test('first stream data flips connection state to live', () async {
      client.connect();
      await Future<void>.delayed(Duration.zero);
      provider.emit('event: new_request\ndata: {"requestId":"r1"}\n\n');
      await Future<void>.delayed(Duration.zero);

      expect(connectionStates, contains(true));
    });

    test('disconnect closes the connection and reports not-live', () async {
      client.connect();
      await Future<void>.delayed(Duration.zero);
      provider.emit('event: new_request\ndata: {"requestId":"r1"}\n\n');
      await Future<void>.delayed(Duration.zero);

      client.disconnect();

      expect(client.isConnected, isFalse);
      expect(provider.disconnected, isTrue);
      expect(connectionStates.last, isFalse);
    });
  });

  group('Robustness', () {
    test('heartbeat comments and malformed frames emit nothing', () async {
      client.connect();
      await Future<void>.delayed(Duration.zero);

      provider.emit(': ping\n\n');
      provider.emit('event: new_request\ndata: not-json\n\n');
      await Future<void>.delayed(Duration.zero);

      expect(receivedEvents, isEmpty);
    });

    test('double connect is a no-op', () async {
      client.connect();
      client.connect();
      await Future<void>.delayed(Duration.zero);

      expect(provider.connectCount, equals(1));
    });

    test('is not connected until connect() is called', () {
      expect(client.isConnected, isFalse);
    });
  });
}

class _FakeConnectionProvider implements SseConnectionProvider {
  final StreamController<String> _controller = StreamController<String>.broadcast();
  bool connected = false;
  bool disconnected = false;
  int connectCount = 0;
  String? lastUrl;
  Map<String, String>? lastHeaders;

  @override
  Stream<String> connect(String url, Map<String, String> headers) {
    connected = true;
    connectCount++;
    lastUrl = url;
    lastHeaders = headers;
    return _controller.stream;
  }

  @override
  void disconnect() {
    disconnected = true;
    connected = false;
  }

  void emit(String chunk) => _controller.add(chunk);
}
