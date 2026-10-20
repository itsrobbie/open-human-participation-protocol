import 'package:flutter/foundation.dart';

/// Severity of a diagnostic log entry.
enum DevLogLevel { debug, info, warning, error }

extension DevLogLevelX on DevLogLevel {
  String get label {
    switch (this) {
      case DevLogLevel.debug:
        return 'DEBUG';
      case DevLogLevel.info:
        return 'INFO';
      case DevLogLevel.warning:
        return 'WARN';
      case DevLogLevel.error:
        return 'ERROR';
    }
  }
}

/// A single diagnostic log entry.
@immutable
class DevLogEntry {
  final DateTime timestamp;
  final DevLogLevel level;

  /// Short subsystem tag, e.g. 'api', 'sse', 'device', 'auth'.
  final String tag;
  final String message;

  /// Optional extra detail (already redacted). Shown expanded in the viewer.
  final String? detail;

  const DevLogEntry({
    required this.timestamp,
    required this.level,
    required this.tag,
    required this.message,
    this.detail,
  });

  /// One-line, copy-friendly rendering.
  String format() {
    final ts = timestamp.toIso8601String();
    final base = '$ts  ${level.label.padRight(5)}  [$tag] $message';
    return detail == null || detail!.isEmpty ? base : '$base\n    $detail';
  }
}

/// In-app diagnostic logger. A [ChangeNotifier] so the viewer rebuilds live.
///
/// Global-singleton access ([DevLog.instance]) lets non-Riverpod call sites
/// (the Dio interceptor, device registration, SSE client) write to it without
/// plumbing a provider everywhere. The UI reads it via the same singleton.
///
/// Logging is OFF by default and only records when [enabled] is true, set from
/// the persisted developer setting. Sensitive values must be redacted by the
/// caller (see [DevLog.redact]); this buffer does no redaction itself beyond a
/// safety pass on Authorization-like content.
class DevLog extends ChangeNotifier {
  DevLog._();
  static final DevLog instance = DevLog._();

  static const int _maxEntries = 500;

  final List<DevLogEntry> _entries = <DevLogEntry>[];
  bool _enabled = false;

  bool get enabled => _enabled;
  set enabled(bool value) {
    if (_enabled == value) return;
    _enabled = value;
    // Announce the state change itself so the transition is visible.
    _add(DevLogEntry(
      timestamp: DateTime.now(),
      level: DevLogLevel.info,
      tag: 'devlog',
      message: value ? 'Developer logging enabled' : 'Developer logging disabled',
    ));
    notifyListeners();
  }

  /// Snapshot of entries, newest last (chronological).
  List<DevLogEntry> get entries => List.unmodifiable(_entries);

  void log(
    DevLogLevel level,
    String tag,
    String message, {
    String? detail,
  }) {
    if (!_enabled) return;
    _add(DevLogEntry(
      timestamp: DateTime.now(),
      level: level,
      tag: tag,
      message: message,
      detail: detail == null ? null : redact(detail),
    ));
    notifyListeners();
  }

  void debug(String tag, String message, {String? detail}) =>
      log(DevLogLevel.debug, tag, message, detail: detail);
  void info(String tag, String message, {String? detail}) =>
      log(DevLogLevel.info, tag, message, detail: detail);
  void warning(String tag, String message, {String? detail}) =>
      log(DevLogLevel.warning, tag, message, detail: detail);
  void error(String tag, String message, {String? detail}) =>
      log(DevLogLevel.error, tag, message, detail: detail);

  void clear() {
    _entries.clear();
    notifyListeners();
  }

  /// All entries as one copyable block, newest last.
  String exportText() => _entries.map((e) => e.format()).join('\n');

  void _add(DevLogEntry entry) {
    _entries.add(entry);
    if (_entries.length > _maxEntries) {
      _entries.removeRange(0, _entries.length - _maxEntries);
    }
    // Mirror to the debug console too (no-op in release except via logs view).
    if (kDebugMode) {
      // ignore: avoid_print
      debugPrint(entry.format());
    }
  }

  /// Redact obvious secrets from a detail string before it is stored/shown.
  /// Masks bearer tokens, ohpp device tokens, and JWT-looking blobs. This is a
  /// safety net; callers should still avoid passing raw secrets.
  static String redact(String input) {
    var out = input;
    // Authorization: Bearer <token>  and  "Authorization": "Bearer <token>"
    out = out.replaceAll(
      RegExp(r'(Bearer\s+)[A-Za-z0-9._\-]+', caseSensitive: false),
      r'$1<redacted>',
    );
    // ohpp device tokens (ohpp_dev_...) anywhere.
    out = out.replaceAll(
      RegExp(r'ohpp_dev_[A-Za-z0-9._\-]+'),
      'ohpp_dev_<redacted>',
    );
    // JWT-looking triple-segment blobs (header.payload.signature).
    out = out.replaceAll(
      RegExp(r'eyJ[A-Za-z0-9._\-]{10,}'),
      '<jwt-redacted>',
    );
    // access_token / refresh_token / deviceToken JSON fields.
    out = out.replaceAll(
      RegExp(
        r'("(?:access_token|refresh_token|deviceToken|password|token)"\s*:\s*")[^"]*(")',
        caseSensitive: false,
      ),
      r'$1<redacted>$2',
    );
    return out;
  }
}
