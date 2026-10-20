import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:pointycastle/export.dart';

import 'package:ohpp_client/core/crypto/agent_crypto_service.dart';

import '../../support/in_memory_secure_storage.dart' show inMemorySecureStorage;

/// These tests pin the wire contract the resolver's real ES256 verifier
/// (.NET ECDsa.VerifyData over UTF-8 payload, base64url signature, SPKI PEM key)
/// relies on. If they pass, an attestation signed by [AgentCryptoService] and a
/// key registered from its [DevicePublicKey] will verify server-side.
void main() {
  const canonicalPayload = '{"selectedOption":"approve"}';

  test('signature verifies against its own exported public key (P-256/SHA-256)',
      () async {
    final svc = AgentCryptoService(storage: inMemorySecureStorage());
    final pub = await svc.ensurePublicKey();
    expect(pub.algorithm, 'ES256');
    expect(pub.publicKeyPem, contains('BEGIN PUBLIC KEY'));

    final sigB64Url = await svc.sign(canonicalPayload);

    // Rebuild the public key from the exported SPKI PEM and verify the raw
    // r||s signature the way the .NET verifier does.
    final pubKey = _publicKeyFromSpkiPem(pub.publicKeyPem);
    final raw = _base64UrlDecode(sigB64Url);
    expect(raw.length, 64, reason: 'ES256 raw signature is 32-byte r || 32-byte s');
    final r = _bytesToBigInt(raw.sublist(0, 32));
    final s = _bytesToBigInt(raw.sublist(32, 64));

    final verifier = Signer('SHA-256/ECDSA') as ECDSASigner;
    verifier.init(false, PublicKeyParameter<ECPublicKey>(pubKey));
    final ok = verifier.verifySignature(
      Uint8List.fromList(utf8.encode(canonicalPayload)),
      ECSignature(r, s),
    );
    expect(ok, isTrue, reason: 'signature must verify against the exported key');
  });

  test('a different payload does not verify (tamper check)', () async {
    final svc = AgentCryptoService(storage: inMemorySecureStorage());
    final pub = await svc.ensurePublicKey();
    final sigB64Url = await svc.sign(canonicalPayload);

    final pubKey = _publicKeyFromSpkiPem(pub.publicKeyPem);
    final raw = _base64UrlDecode(sigB64Url);
    final verifier = Signer('SHA-256/ECDSA') as ECDSASigner;
    verifier.init(false, PublicKeyParameter<ECPublicKey>(pubKey));
    final ok = verifier.verifySignature(
      Uint8List.fromList(utf8.encode('{"selectedOption":"deny"}')),
      ECSignature(
          _bytesToBigInt(raw.sublist(0, 32)), _bytesToBigInt(raw.sublist(32, 64))),
    );
    expect(ok, isFalse);
  });

  test('key is stable across instances sharing storage', () async {
    final storage = inMemorySecureStorage();
    final a = AgentCryptoService(storage: storage);
    final b = AgentCryptoService(storage: storage);
    final pubA = await a.ensurePublicKey();
    final pubB = await b.ensurePublicKey();
    expect(pubB.publicKeyPem, pubA.publicKeyPem,
        reason: 'the persisted private key must yield the same public key');
  });
}

// --- helpers: decode our SPKI PEM back into a pointycastle public key --------

ECPublicKey _publicKeyFromSpkiPem(String pem) {
  final b64 = pem
      .replaceAll('-----BEGIN PUBLIC KEY-----', '')
      .replaceAll('-----END PUBLIC KEY-----', '')
      .replaceAll(RegExp(r'\s'), '');
  final der = base64.decode(b64);
  // The uncompressed EC point is the last 65 bytes: 0x04 || X(32) || Y(32).
  final point = der.sublist(der.length - 65);
  expect(point[0], 0x04);
  final x = _bytesToBigInt(point.sublist(1, 33));
  final y = _bytesToBigInt(point.sublist(33, 65));
  final params = ECDomainParameters('prime256v1');
  final q = params.curve.createPoint(x, y);
  return ECPublicKey(q, params);
}

Uint8List _base64UrlDecode(String input) {
  var s = input.replaceAll('-', '+').replaceAll('_', '/');
  switch (s.length % 4) {
    case 2:
      s += '==';
      break;
    case 3:
      s += '=';
      break;
  }
  return base64.decode(s);
}

BigInt _bytesToBigInt(List<int> bytes) {
  var result = BigInt.zero;
  for (final b in bytes) {
    result = (result << 8) | BigInt.from(b);
  }
  return result;
}
