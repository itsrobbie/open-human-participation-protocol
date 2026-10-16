import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

import 'cert_pinner.dart';

/// Applies certificate pinning (U7.1, Phase 6) to a [Dio] instance's underlying
/// HttpClient. When the pinner is enabled, the TLS server certificate must match
/// a compiled-in pin or the connection is refused (fail-closed).
///
/// [devRootCaPem], when provided, is added to the client's trust store so dev
/// builds trust the local step-ca root without a system-level install.
void applyCertPinning(
  Dio dio,
  CertPinner pinner, {
  String? devRootCaPem,
}) {
  // Nothing to do when pinning is off and there's no custom root to trust.
  if (!pinner.isEnabled && (devRootCaPem == null || devRootCaPem.isEmpty)) {
    return;
  }

  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      SecurityContext? context;
      if (devRootCaPem != null && devRootCaPem.isNotEmpty) {
        context = SecurityContext(withTrustedRoots: true);
        try {
          context.setTrustedCertificatesBytes(devRootCaPem.codeUnits);
        } catch (_) {
          // Adding the dev root is best-effort; pinning still enforces identity.
        }
      }
      final client = HttpClient(context: context);
      // validateCertificate runs after chain validation; enforce the pin here.
      client.badCertificateCallback = (cert, host, port) {
        // Only reached when the default chain validation fails. If pinning is
        // enabled and the presented cert matches a pin, accept it (covers the
        // dev root not being installed system-wide); otherwise reject.
        return pinner.isValidCert(cert.der);
      };
      return client;
    },
    validateCertificate: (cert, host, port) {
      if (cert == null) return false;
      return pinner.isValidCert(cert.der);
    },
  );
}
