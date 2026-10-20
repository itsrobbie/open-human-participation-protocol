import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'analytics_sink.dart';

/// Analytics sink backed by self-hosted Umami (U7.1, Phase 7).
///
/// Umami has no Flutter SDK; its documented server-side ingest is a single
/// `POST /api/send` with an event payload keyed by the website UUID. Host + key
/// are supplied at build time via --dart-define (ANALYTICS_HOST / ANALYTICS_KEY,
/// where ANALYTICS_KEY is the Umami website UUID). When either is unset the app
/// uses [NoopAnalyticsSink], so this class is only constructed when both exist.
///
/// Fail-open (NFR-A1): capture never throws and never blocks the app. Properties
/// are scrubbed to the non-PII allowlist before sending. Events are anonymous
/// (Umami is cookieless and stores no PII).
///
/// Umami replaced PostHog: current PostHog self-host requires Kafka + ~16GB RAM
/// and cannot cleanly reuse shared datastores, which breaks this unit's lean
/// one-command dev goal. Umami is Postgres-only and still provides events,
/// funnels, retention, and journeys.
class UmamiAnalyticsSink implements AnalyticsSink {
  UmamiAnalyticsSink({required String host, required String websiteId})
      : _sendUri = Uri.parse('${_trimTrailingSlash(host)}/api/send'),
        _websiteId = websiteId,
        _enabled = host.trim().isNotEmpty && websiteId.trim().isNotEmpty;

  final Uri _sendUri;
  final String _websiteId;
  final bool _enabled;

  /// Must match the seeded Umami website's domain for event attribution.
  static const String _hostname = 'ohpp.local';

  /// A realistic browser UA: Umami drops "bot-looking" User-Agents (isbot), so a
  /// non-browser UA would make events silently vanish. Carries no PII.
  static const String _userAgent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  static String _trimTrailingSlash(String s) =>
      s.endsWith('/') ? s.substring(0, s.length - 1) : s;

  @override
  bool get isEnabled => _enabled;

  @override
  Future<void> capture(String event, {Map<String, Object> properties = const {}}) async {
    if (!_enabled) return;
    try {
      final scrubbed = AnalyticsPropertyScrubber.scrub(properties);
      final body = jsonEncode({
        'type': 'event',
        'payload': {
          'website': _websiteId,
          'name': event,
          // Umami attributes events to the website by hostname and requires a
          // url; without a url it accepts the POST (200) but drops the event.
          'hostname': _hostname,
          'url': '/$event',
          if (scrubbed.isNotEmpty) 'data': scrubbed,
        },
      });

      final client = HttpClient();
      try {
        final request = await client.postUrl(_sendUri);
        request.headers.contentType = ContentType('application', 'json');
        // Umami silently drops requests whose User-Agent looks like a bot (it
        // uses the isbot heuristic). A non-browser UA like "ohpp-client/1.0" is
        // treated as a bot and the event never records, so present a realistic
        // mobile browser UA. This carries no PII.
        request.headers.set(HttpHeaders.userAgentHeader, _userAgent);
        request.write(body);
        final response = await request.close();
        await response.drain<void>();
      } finally {
        client.close(force: true);
      }
    } catch (e) {
      // Fail-open: analytics must never break the app.
      debugPrint('[UmamiAnalyticsSink] capture failed (ignored): $e');
    }
  }
}
