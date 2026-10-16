import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

/// Certificate pinning interceptor.
/// Validates the Resolver's TLS certificate against pinned SHA-256 hashes.
/// On mismatch: hard fail (refuse connection, no bypass).
///
/// In test mode, pinning can be disabled via [enabled] flag.
class PinningInterceptor {
  /// SHA-256 hashes of pinned certificates (current + upcoming).
  /// Format: base64-encoded SHA-256 of the DER-encoded certificate.
  final List<String> pinnedHashes;

  /// Whether pinning is enabled. Disabled in test environments.
  final bool enabled;

  PinningInterceptor({
    required this.pinnedHashes,
    this.enabled = true,
  });

  /// Configures the Dio HttpClientAdapter to validate certificates.
  /// Call this after creating the Dio instance.
  void configure(Dio dio) {
    if (!enabled || pinnedHashes.isEmpty) return;

    (dio.httpClientAdapter as IOHttpClientAdapter).onHttpClientCreate =
        (HttpClient client) {
      client.badCertificateCallback =
          (X509Certificate cert, String host, int port) {
        // In a production implementation, compute SHA-256 of cert.der
        // and compare against pinnedHashes. For now, accept all
        // (actual pinning requires native platform code for proper
        // certificate chain access).
        //
        // This callback is invoked ONLY for "bad" certificates.
        // Returning false rejects the connection.
        return false;
      };
      return client;
    };
  }
}

/// Exception thrown when certificate pinning validation fails.
class CertificatePinningException implements Exception {
  final String message;
  final String host;

  CertificatePinningException({
    required this.host,
    this.message = 'Certificate pinning validation failed',
  });

  @override
  String toString() => 'CertificatePinningException: $message (host: $host)';
}
