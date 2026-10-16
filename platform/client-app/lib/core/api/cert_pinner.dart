import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Certificate pinning for the Resolver connection (U7.1, Phase 6).
///
/// Pins are SHA-256 hashes of the server certificate's DER encoding, in the
/// standard `sha256/<base64>` form, supplied at build time via
/// --dart-define=RESOLVER_CERT_PIN (comma-separated for a primary + backup pin
/// so a cert rotation doesn't brick the app).
///
/// Pinning on the whole-certificate DER (rather than the SPKI substructure) is
/// a legitimate, widely-used strategy and avoids fragile in-app ASN.1 parsing;
/// the primary+backup scheme still allows planned rotation. The Dio wiring
/// (cert_pinning_adapter.dart) feeds this the server cert's DER bytes from the
/// TLS handshake.
///
/// Fail-closed: when one or more pins are compiled in, a certificate whose hash
/// is not among them is REJECTED. Pinning is disabled (accept) only when NO pin
/// is compiled in - e.g. tests or an explicitly non-pinned build. The comparison
/// logic here is pure and unit-tested.
class CertPinner {
  /// Allowed pins in `sha256/<base64>` form. Empty => pinning disabled.
  final List<String> pins;

  CertPinner(this.pins);

  /// Parse a `--dart-define` value: comma-separated `sha256/<base64>` pins.
  /// Blank => empty (pinning disabled).
  factory CertPinner.fromDefine(String raw) {
    final pins = raw
        .split(',')
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    return CertPinner(pins);
  }

  /// True when at least one pin is compiled in (i.e. pinning is enforced).
  bool get isEnabled => pins.isNotEmpty;

  /// Compute the pin (`sha256/<base64>`) for a DER-encoded certificate.
  static String pinForCertDer(List<int> certDer) {
    final digest = sha256.convert(certDer);
    return 'sha256/${base64.encode(digest.bytes)}';
  }

  /// Whether a certificate (identified by its DER bytes) is acceptable.
  /// - Pinning disabled (no pins): always true (allow).
  /// - Pinning enabled: true only if the computed pin matches an allowed pin
  ///   (fail-closed).
  bool isValidCert(List<int> certDer) {
    if (!isEnabled) return true;
    final computed = pinForCertDer(certDer);
    return pins.contains(computed);
  }

  /// Convenience: check a pre-computed pin string against the allowlist.
  bool isValidPin(String pin) {
    if (!isEnabled) return true;
    return pins.contains(pin);
  }
}
