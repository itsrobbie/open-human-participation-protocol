import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';
import 'package:pointycastle/export.dart';

/// Agent-friendly software signer for simulators and automated tests.
///
/// The whole point of the app is that a human proves participation, so on a
/// real device the signing key lives in the Secure Enclave / hardware KeyStore
/// and is gated by biometrics — no on-device agent can sign. That hardware is
/// unavailable on simulators and cannot be driven by an automated agent, so in
/// the `test` anti-agent mode we substitute this software P-256 signer behind
/// the same [CryptoServiceInterface].
///
/// It produces a REAL ES256 signature (ECDSA P-256 + SHA-256) so the resolver's
/// genuine signature verification passes, and exposes the matching public key
/// as SPKI PEM so the composition root can register it. The private key is
/// persisted in secure storage so the registered public key keeps matching
/// across app launches.
///
/// This must never be selected on a release/device build. Selection happens
/// once at the composition root via the build-time anti-agent mode flag.
class AgentCryptoService implements CryptoServiceInterface {
  final FlutterSecureStorage _storage;

  static const _keyPrivateD = 'ohpp_agent_ec_private_d';
  static const _algorithm = 'ES256';

  ECPrivateKey? _privateKey;
  ECPublicKey? _publicKey;

  AgentCryptoService({FlutterSecureStorage storage = const FlutterSecureStorage()})
      : _storage = storage;

  static final ECDomainParameters _p256 = ECDomainParameters('prime256v1');

  @override
  Future<DevicePublicKey> ensurePublicKey() async {
    await _ensureKeyPair();
    return DevicePublicKey(
      publicKeyPem: _encodeSpkiPem(_publicKey!),
      algorithm: _algorithm,
    );
  }

  @override
  Future<String> sign(String payload) async {
    await _ensureKeyPair();

    final signer = Signer('SHA-256/ECDSA') as ECDSASigner;
    final random = _secureRandom();
    signer.init(
      true,
      ParametersWithRandom(PrivateKeyParameter<ECPrivateKey>(_privateKey!), random),
    );

    final sig = signer.generateSignature(
      Uint8List.fromList(utf8.encode(payload)),
    ) as ECSignature;

    // The resolver verifies with .NET ECDsa.VerifyData, which expects the
    // IEEE-P1363 fixed-width r||s form (32 bytes each for P-256), base64url.
    final n = _p256.n;
    var s = sig.s;
    // Use the low-S form for determinism/interop (not required by the verifier,
    // but conventional and avoids any high-S rejection elsewhere).
    if (s.compareTo(n >> 1) > 0) {
      s = n - s;
    }
    final rBytes = _toFixed32(sig.r);
    final sBytes = _toFixed32(s);
    final raw = Uint8List(64)
      ..setRange(0, 32, rBytes)
      ..setRange(32, 64, sBytes);
    return _base64Url(raw);
  }

  // --- key material ---------------------------------------------------------

  Future<void> _ensureKeyPair() async {
    if (_privateKey != null && _publicKey != null) return;

    final storedD = await _storage.read(key: _keyPrivateD);
    if (storedD != null) {
      final d = BigInt.parse(storedD, radix: 16);
      _privateKey = ECPrivateKey(d, _p256);
      _publicKey = ECPublicKey(_p256.G * d, _p256);
      return;
    }

    // Generate a fresh P-256 keypair and persist the private scalar.
    final gen = KeyGenerator('EC')
      ..init(ParametersWithRandom(
        ECKeyGeneratorParameters(_p256),
        _secureRandom(),
      ));
    final pair = gen.generateKeyPair();
    _privateKey = pair.privateKey as ECPrivateKey;
    _publicKey = pair.publicKey as ECPublicKey;
    await _storage.write(
      key: _keyPrivateD,
      value: _privateKey!.d!.toRadixString(16),
    );
  }

  SecureRandom _secureRandom() {
    final fr = FortunaRandom();
    final seed = Uint8List(32);
    final rnd = Random.secure();
    for (var i = 0; i < seed.length; i++) {
      seed[i] = rnd.nextInt(256);
    }
    fr.seed(KeyParameter(seed));
    return fr;
  }

  static Uint8List _toFixed32(BigInt value) {
    final bytes = _bigIntToBytes(value);
    if (bytes.length == 32) return bytes;
    final out = Uint8List(32);
    out.setRange(32 - bytes.length, 32, bytes);
    return out;
  }

  static Uint8List _bigIntToBytes(BigInt value) {
    var v = value;
    final bytes = <int>[];
    while (v > BigInt.zero) {
      bytes.insert(0, (v & BigInt.from(0xff)).toInt());
      v = v >> 8;
    }
    if (bytes.isEmpty) bytes.add(0);
    return Uint8List.fromList(bytes);
  }

  static String _base64Url(Uint8List bytes) =>
      base64Url.encode(bytes).replaceAll('=', '');

  // --- SPKI PEM encoding (P-256) --------------------------------------------

  /// Encode a P-256 public key as a SubjectPublicKeyInfo DER, PEM-wrapped, which
  /// is what the resolver's ECDsa.ImportFromPem expects.
  static String _encodeSpkiPem(ECPublicKey key) {
    // Uncompressed EC point: 0x04 || X(32) || Y(32).
    final q = key.Q!;
    final x = _toFixed32(q.x!.toBigInteger()!);
    final y = _toFixed32(q.y!.toBigInteger()!);
    final point = Uint8List(65)
      ..[0] = 0x04
      ..setRange(1, 33, x)
      ..setRange(33, 65, y);

    // AlgorithmIdentifier: id-ecPublicKey (1.2.840.10045.2.1) + prime256v1
    // (1.2.840.10045.3.1.7). SPKI = SEQUENCE { AlgId SEQUENCE { oid, oid },
    // BIT STRING(point) }. Build the DER by hand to avoid an extra dependency.
    final oidEcPublicKey = _der(0x06, _oidBytes([1, 2, 840, 10045, 2, 1]));
    final oidP256 = _der(0x06, _oidBytes([1, 2, 840, 10045, 3, 1, 7]));
    final algId = _der(0x30, Uint8List.fromList([...oidEcPublicKey, ...oidP256]));
    // BIT STRING: leading 0x00 "unused bits" octet before the point.
    final bitString = _der(0x03, Uint8List.fromList([0x00, ...point]));
    final spki = _der(0x30, Uint8List.fromList([...algId, ...bitString]));

    final b64 = base64.encode(spki);
    final lines = <String>['-----BEGIN PUBLIC KEY-----'];
    for (var i = 0; i < b64.length; i += 64) {
      lines.add(b64.substring(i, i + 64 > b64.length ? b64.length : i + 64));
    }
    lines.add('-----END PUBLIC KEY-----');
    return lines.join('\n');
  }

  /// Wrap [content] in a DER TLV with the given [tag], encoding the length.
  static Uint8List _der(int tag, List<int> content) {
    final len = content.length;
    final out = <int>[tag];
    if (len < 0x80) {
      out.add(len);
    } else {
      final lenBytes = _bigIntToBytes(BigInt.from(len));
      out.add(0x80 | lenBytes.length);
      out.addAll(lenBytes);
    }
    out.addAll(content);
    return Uint8List.fromList(out);
  }

  /// Encode an OID's arc list into DER OID content bytes.
  static List<int> _oidBytes(List<int> arcs) {
    final out = <int>[40 * arcs[0] + arcs[1]];
    for (var i = 2; i < arcs.length; i++) {
      out.addAll(_base128(arcs[i]));
    }
    return out;
  }

  static List<int> _base128(int value) {
    if (value == 0) return [0];
    final bytes = <int>[];
    var v = value;
    while (v > 0) {
      bytes.insert(0, v & 0x7f);
      v >>= 7;
    }
    for (var i = 0; i < bytes.length - 1; i++) {
      bytes[i] |= 0x80;
    }
    return bytes;
  }
}
