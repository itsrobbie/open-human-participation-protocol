import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/cert_pinner.dart';

void main() {
  // Two distinct fake "certificate DER" byte arrays and their computed pins.
  final certA = utf8.encode('fake-cert-A-der-bytes');
  final certB = utf8.encode('fake-cert-B-der-bytes');
  final pinA = CertPinner.pinForCertDer(certA);
  final pinB = CertPinner.pinForCertDer(certB);

  group('CertPinner', () {
    test('pinning_disabledOnlyWhenNoPinCompiledIn', () {
      final pinner = CertPinner.fromDefine('');
      expect(pinner.isEnabled, isFalse);
      // Disabled => accept anything (including an otherwise-unknown cert).
      expect(pinner.isValidCert(certA), isTrue);
      expect(pinner.isValidCert(certB), isTrue);
    });

    test('pinning_acceptsMatchingCert', () {
      final pinner = CertPinner([pinA]);
      expect(pinner.isEnabled, isTrue);
      expect(pinner.isValidCert(certA), isTrue);
    });

    test('pinning_rejectsDifferentCert_failClosed', () {
      final pinner = CertPinner([pinA]);
      // A cert that doesn't match the single pin must be rejected.
      expect(pinner.isValidCert(certB), isFalse);
    });

    test('pinning_backupPinAccepted', () {
      // Primary + backup pins (comma-separated define). The backup cert is
      // accepted even though it's not the primary - this is what lets a planned
      // rotation succeed without bricking the app.
      final pinner = CertPinner.fromDefine('$pinA,$pinB');
      expect(pinner.pins, hasLength(2));
      expect(pinner.isValidCert(certA), isTrue);
      expect(pinner.isValidCert(certB), isTrue);
      // A third, unknown cert is still rejected.
      expect(pinner.isValidCert(utf8.encode('cert-C')), isFalse);
    });

    test('fromDefine trims and ignores blanks', () {
      final pinner = CertPinner.fromDefine(' $pinA , , $pinB ');
      expect(pinner.pins, [pinA, pinB]);
    });

    test('pin format is sha256/<base64>', () {
      expect(pinA, startsWith('sha256/'));
      // base64 of a 32-byte SHA-256 digest is 44 chars.
      expect(pinA.substring('sha256/'.length).length, 44);
    });
  });
}
