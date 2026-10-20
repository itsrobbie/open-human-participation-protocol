import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/shared/models/participation_request.dart';

/// Bug 4: the app's countdown showed time remaining for a request the server
/// had already expired. Root cause is a timezone-naive parse of the server's
/// expiry (a UTC instant) and a comparison against local `DateTime.now()`.
///
/// These tests pin the contract:
///  1. `expiry` parsed from a UTC instant must be a UTC DateTime.
///  2. Whether the server sends 'Z' or '+00:00', the absolute instant is equal.
///  3. Remaining time must be computed against the same (UTC) reference so an
///     already-past expiry reads as non-positive, not a couple of minutes left.
void main() {
  group('ParticipationRequest expiry parsing (Bug 4)', () {
    test('expiry from a Z-suffixed UTC string is stored as UTC', () {
      final req = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'expiry': '2026-09-02T23:45:00Z',
      });
      expect(req.expiry, isNotNull);
      expect(req.expiry!.isUtc, isTrue,
          reason: 'expiry must be UTC so it can be compared against now.toUtc()');
    });

    test('expiry with +00:00 offset equals the same instant as Z', () {
      final zForm = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'expiry': '2026-09-02T23:45:00Z',
      }).expiry!;
      final offsetForm = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'expiry': '2026-09-02T23:45:00+00:00',
      }).expiry!;
      expect(offsetForm.toUtc().isAtSameMomentAs(zForm.toUtc()), isTrue);
    });

    test('expiry without a zone designator is treated as UTC (server sends UTC)', () {
      // .NET can serialize DateTimeOffset/DateTime without a 'Z' or offset. A
      // bare timestamp represents the server's UTC instant, but DateTime.parse
      // treats it as LOCAL, inflating "remaining" by the device's UTC offset —
      // the ~2 minutes-to-hours skew behind Bug 4. The model must normalize to
      // UTC so the countdown matches server truth.
      final req = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'expiry': '2026-09-02T23:45:00', // no Z, no offset
      });
      expect(req.expiry, isNotNull);
      expect(req.expiry!.isUtc, isTrue,
          reason: 'a zone-less server timestamp must be interpreted as UTC');
      // And it must equal the same instant as the explicit-Z form.
      final zForm =
          DateTime.parse('2026-09-02T23:45:00Z');
      expect(req.expiry!.isAtSameMomentAs(zForm), isTrue);
    });

    test('an already-past expiry has non-positive remaining time', () {
      // Server instant one minute in the past, expressed in UTC.
      final past = DateTime.now().toUtc().subtract(const Duration(minutes: 1));
      final req = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'expiry': past.toIso8601String(),
      });
      // The countdown compares against now in UTC; a past expiry must be <= 0,
      // never ~2 minutes remaining.
      final remaining = req.expiry!.difference(DateTime.now().toUtc());
      expect(remaining.isNegative || remaining == Duration.zero, isTrue,
          reason: 'a past server expiry must not show time remaining');
    });

    test('receivedAt from a UTC string is stored as UTC', () {
      final req = ParticipationRequest.fromJson({
        'requestId': 'r1',
        'type': 'select',
        'receivedAt': '2026-09-02T23:00:00Z',
      });
      expect(req.receivedAt.isUtc, isTrue);
    });
  });
}
