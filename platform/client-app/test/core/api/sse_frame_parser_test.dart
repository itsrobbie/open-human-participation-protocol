import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/core/api/sse_frame_parser.dart';

/// Real SSE wire format from the resolver:
///   event: <type>\n
///   data: <json>\n
///   \n                       <- blank line terminates a frame
/// plus heartbeat comment lines ": ping\n\n" that must be ignored.
///
/// The parser is fed raw chunks (which may split lines arbitrarily) and must
/// emit one SseEvent per complete frame, with the correct event type and
/// parsed JSON data.
void main() {
  group('SseFrameParser', () {
    test('parses a complete new_request frame with typed event + JSON data', () {
      final parser = SseFrameParser();
      final events = <SseFrame>[];

      parser.addChunk('event: new_request\n'
          'data: {"requestId":"r1","summary":"Approve payment"}\n'
          '\n');
      events.addAll(parser.drain());

      expect(events, hasLength(1));
      expect(events.single.event, 'new_request');
      expect(events.single.data['requestId'], 'r1');
      expect(events.single.data['summary'], 'Approve payment');
    });

    test('ignores heartbeat comment lines', () {
      final parser = SseFrameParser();
      parser.addChunk(': ping\n\n');
      expect(parser.drain(), isEmpty);
    });

    test('handles a frame split across multiple chunks', () {
      final parser = SseFrameParser();
      parser.addChunk('event: new_re');
      parser.addChunk('quest\ndata: {"requestId":"r2"}\n');
      expect(parser.drain(), isEmpty, reason: 'frame not terminated yet');
      parser.addChunk('\n'); // terminating blank line
      final events = parser.drain();
      expect(events, hasLength(1));
      expect(events.single.event, 'new_request');
      expect(events.single.data['requestId'], 'r2');
    });

    test('parses multiple frames in one chunk', () {
      final parser = SseFrameParser();
      parser.addChunk('event: request_expired\n'
          'data: {"requestId":"r3","status":"Expired"}\n'
          '\n'
          'event: request_cancelled\n'
          'data: {"requestId":"r4","status":"Cancelled"}\n'
          '\n');
      final events = parser.drain();
      expect(events, hasLength(2));
      expect(events[0].event, 'request_expired');
      expect(events[0].data['requestId'], 'r3');
      expect(events[1].event, 'request_cancelled');
      expect(events[1].data['status'], 'Cancelled');
    });

    test('skips a frame whose data is not valid JSON (no crash)', () {
      final parser = SseFrameParser();
      parser.addChunk('event: new_request\ndata: not-json\n\n');
      expect(parser.drain(), isEmpty);
    });

    test('defaults event type to "message" when only data is present', () {
      final parser = SseFrameParser();
      parser.addChunk('data: {"requestId":"r5"}\n\n');
      final events = parser.drain();
      expect(events, hasLength(1));
      expect(events.single.event, 'message');
      expect(events.single.data['requestId'], 'r5');
    });
  });
}
