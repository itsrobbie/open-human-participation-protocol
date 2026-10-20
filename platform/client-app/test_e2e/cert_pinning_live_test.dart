import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/cert_pinner.dart';
import 'package:ohpp_client/core/api/cert_pinning_adapter.dart';

/// Live certificate-pinning verification (U7.1, Phase 6 close-out).
///
/// The pure pin-matching logic is covered by test/core/api/cert_pinner_test.dart.
/// This test proves the *wiring* end to end against the real Resolver TLS
/// endpoint: a real Dio client with the pinning adapter installed
///  - ACCEPTS the connection when pinned to the resolver's actual leaf cert, and
///  - REJECTS it (fail-closed) when pinned to a different cert.
///
/// It is deliberately NOT part of the hermetic `flutter test` (test/) suite: it
/// needs the dev stack up. Run it via `make flutter-verify-pinning` (which boots
/// the dev backing + resolver and passes DEV_ROOT_CA_PEM + RESOLVER_TLS_URL).
///
/// Config (via --dart-define):
///   RESOLVER_TLS_URL       e.g. https://localhost:5443
///   DEV_ROOT_CA_PEM_B64    the step-ca root CA PEM, base64-encoded (a PEM has
///                          newlines which cannot be passed as a single CLI arg,
///                          so it is base64-wrapped and decoded here)
void main() {
  const resolverUrl =
      String.fromEnvironment('RESOLVER_TLS_URL', defaultValue: 'https://localhost:5443');
  const devRootCaPemB64 = String.fromEnvironment('DEV_ROOT_CA_PEM_B64');
  final devRootCaPem =
      devRootCaPemB64.isEmpty ? '' : String.fromCharCodes(base64.decode(devRootCaPemB64));

  // A well-formed but deliberately-wrong pin (sha256 of bytes the resolver cert
  // will never equal). Used to prove fail-closed rejection.
  final wrongPin = CertPinner.pinForCertDer(
    List<int>.generate(64, (i) => (i * 7 + 13) % 256),
  );

  /// Fetch the resolver leaf cert's DER over a real TLS handshake and return its
  /// pin (sha256/<base64>). Trusts the dev root so the handshake completes.
  Future<String> fetchLiveResolverPin() async {
    final uri = Uri.parse(resolverUrl);
    final ctx = SecurityContext(withTrustedRoots: true);
    if (devRootCaPem.isNotEmpty) {
      ctx.setTrustedCertificatesBytes(devRootCaPem.codeUnits);
    }
    final client = HttpClient(context: ctx);
    X509Certificate? seen;
    client.badCertificateCallback = (cert, host, port) {
      seen = cert;
      return true; // capture the cert regardless; we only want its DER here
    };
    final req = await client.getUrl(uri.replace(path: '/health'));
    final resp = await req.close();
    seen ??= resp.certificate;
    await resp.drain<void>();
    client.close(force: true);
    expect(seen, isNotNull, reason: 'no server certificate observed on TLS handshake');
    return CertPinner.pinForCertDer(seen!.der);
  }

  Dio dioWithPin(String pin) {
    final dio = Dio(BaseOptions(
      baseUrl: resolverUrl,
      validateStatus: (_) => true,
    ));
    applyCertPinning(
      dio,
      CertPinner([pin]),
      devRootCaPem: devRootCaPem.isEmpty ? null : devRootCaPem,
    );
    return dio;
  }

  group('CertPinning (live, against the real Resolver TLS endpoint)', () {
    test('pinning_acceptsRealResolverCert', () async {
      final realPin = await fetchLiveResolverPin();
      final dio = dioWithPin(realPin);

      final resp = await dio.get<dynamic>('/health');
      expect(resp.statusCode, 200,
          reason: 'the resolver /health must succeed when pinned to its real cert');
    });

    test('pinning_rejectsDifferentCert_failClosed', () async {
      final dio = dioWithPin(wrongPin);

      // Fail-closed: the TLS connection must be refused, surfacing as a Dio error.
      await expectLater(
        dio.get<dynamic>('/health'),
        throwsA(isA<DioException>()),
        reason: 'a wrong pin must reject the connection (fail-closed)',
      );
    });
  });
}
