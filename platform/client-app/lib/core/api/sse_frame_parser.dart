import 'dart:convert';

/// One parsed Server-Sent Events frame: an event type and its JSON data.
class SseFrame {
  /// The `event:` field, or 'message' when none was sent (per the SSE spec).
  final String event;

  /// The parsed JSON object from the frame's `data:` field(s).
  final Map<String, dynamic> data;

  const SseFrame({required this.event, required this.data});
}

/// Incremental parser for the resolver's SSE stream.
///
/// The transport delivers arbitrary byte chunks; SSE frames are line-oriented
/// and terminated by a blank line:
///   event: <type>\n
///   data: <json>\n
///   \n
/// Comment lines (starting with ':', used for heartbeats) are ignored. Feed
/// raw chunks with [addChunk] and pull completed frames with [drain].
class SseFrameParser {
  final StringBuffer _buffer = StringBuffer();

  // Fields accumulated for the frame currently being built.
  String? _event;
  final StringBuffer _data = StringBuffer();
  bool _hasData = false;

  final List<SseFrame> _ready = <SseFrame>[];

  /// Feed a raw chunk (may contain partial lines / multiple frames).
  void addChunk(String chunk) {
    _buffer.write(chunk);
    // Normalize CRLF to LF, then process any complete lines.
    var text = _buffer.toString().replaceAll('\r\n', '\n');
    _buffer.clear();

    int newline;
    while ((newline = text.indexOf('\n')) != -1) {
      final line = text.substring(0, newline);
      text = text.substring(newline + 1);
      _handleLine(line);
    }
    // Keep any trailing partial line for the next chunk.
    _buffer.write(text);
  }

  /// Return and clear all frames completed so far.
  List<SseFrame> drain() {
    final out = List<SseFrame>.from(_ready);
    _ready.clear();
    return out;
  }

  void _handleLine(String line) {
    // Blank line: dispatch the current frame (if any) and reset.
    if (line.isEmpty) {
      _dispatch();
      return;
    }
    // Comment / heartbeat line.
    if (line.startsWith(':')) return;

    final colon = line.indexOf(':');
    final field = colon == -1 ? line : line.substring(0, colon);
    // Per spec, a single leading space after the colon is stripped.
    var value = colon == -1 ? '' : line.substring(colon + 1);
    if (value.startsWith(' ')) value = value.substring(1);

    switch (field) {
      case 'event':
        _event = value;
      case 'data':
        if (_hasData) _data.write('\n');
        _data.write(value);
        _hasData = true;
      default:
        // Ignore other fields (id, retry) for now.
        break;
    }
  }

  void _dispatch() {
    if (!_hasData) {
      _resetFrame();
      return;
    }
    final raw = _data.toString();
    final event = _event ?? 'message';
    _resetFrame();
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        _ready.add(SseFrame(event: event, data: decoded));
      }
      // Non-object JSON is ignored (our events are all objects).
    } catch (_) {
      // Malformed JSON: skip the frame rather than crash the stream.
    }
  }

  void _resetFrame() {
    _event = null;
    _data.clear();
    _hasData = false;
  }
}
