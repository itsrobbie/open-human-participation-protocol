import 'dart:convert';

import 'package:ohpp_client/shared/models/models.dart';

/// Interface for the platform crypto service (signing with secure enclave key).
abstract class CryptoServiceInterface {
  /// Sign the canonical attestation payload. Returns the device signature the
  /// resolver verifies against the registered public key (ES256, base64url).
  Future<String> sign(String payload);

  /// Ensure a signing key exists and return its public key as SPKI PEM plus the
  /// algorithm id. The composition root registers this with the resolver
  /// (POST /api/devices/me/keys) so the server can verify future signatures.
  ///
  /// Real (Secure Enclave / KeyStore) implementations return the hardware key's
  /// public part; the agent-friendly implementation returns a software key.
  Future<DevicePublicKey> ensurePublicKey();
}

/// A device's registrable public key: SPKI PEM plus its signature algorithm id.
class DevicePublicKey {
  final String publicKeyPem;
  final String algorithm; // e.g. 'ES256'

  const DevicePublicKey({required this.publicKeyPem, required this.algorithm});
}

/// Error thrown when attestation payload validation fails.
class AttestationValidationError implements Exception {
  final String message;
  AttestationValidationError(this.message);

  @override
  String toString() => 'AttestationValidationError: $message';
}

/// Error thrown when the crypto service fails to sign.
class CryptoSigningError implements Exception {
  final String message;
  CryptoSigningError(this.message);

  @override
  String toString() => 'CryptoSigningError: $message';
}

/// Builds and signs attestation payloads for submission to the Resolver.
class AttestationBuilder {
  final CryptoServiceInterface cryptoService;

  AttestationBuilder({required this.cryptoService});

  /// Build a signed attestation for the given request and decision.
  /// Validates the decision payload, serializes to canonical JSON, signs, and returns.
  Future<SignedAttestation> build({
    required String requestId,
    required String deviceId,
    required AttestationDecision decision,
    required RequestType type,
  }) async {
    // Validate decision matches type
    _validate(decision, type);

    // Build canonical JSON (sorted keys, no whitespace)
    final payload = _buildCanonicalPayload(decision);

    // Sign the payload
    final String signature;
    try {
      signature = await cryptoService.sign(payload);
    } catch (e) {
      if (e is CryptoSigningError) rethrow;
      throw CryptoSigningError(e.toString());
    }

    return SignedAttestation(
      requestId: requestId,
      attestationPayload: payload,
      deviceSignature: signature,
      deviceId: deviceId,
      signedAt: DateTime.now().toUtc(),
    );
  }

  void _validate(AttestationDecision decision, RequestType type) {
    switch (type) {
      case RequestType.select:
        if (decision.selectedOption == null || decision.selectedOption!.isEmpty) {
          throw AttestationValidationError('selectedOption is required for select type');
        }
      case RequestType.multiselect:
        if (decision.selectedOptions == null || decision.selectedOptions!.isEmpty) {
          throw AttestationValidationError('selectedOptions must not be empty for multiselect type');
        }
      case RequestType.text:
        if (decision.value == null || decision.value!.isEmpty) {
          throw AttestationValidationError('value is required for text type');
        }
      case RequestType.number:
        if (decision.value == null || decision.value!.isEmpty) {
          throw AttestationValidationError('value is required for number type');
        }
        if (double.tryParse(decision.value!) == null) {
          throw AttestationValidationError('value must be numeric for number type');
        }
      case RequestType.date:
        if (decision.value == null || decision.value!.isEmpty) {
          throw AttestationValidationError('value is required for date type');
        }
      case RequestType.datetime:
        if (decision.value == null || decision.value!.isEmpty) {
          throw AttestationValidationError('value is required for datetime type');
        }
      case RequestType.signature:
        if (decision.signatureData == null || decision.signatureData!.isEmpty) {
          throw AttestationValidationError('signatureData is required for signature type');
        }
    }
  }

  /// Serialize decision to canonical JSON: sorted keys, no whitespace, only non-null fields.
  String _buildCanonicalPayload(AttestationDecision decision) {
    final map = <String, dynamic>{};

    // Only include non-null fields
    if (decision.selectedOption != null) {
      map['selectedOption'] = decision.selectedOption;
    }
    if (decision.selectedOptions != null) {
      map['selectedOptions'] = decision.selectedOptions;
    }
    if (decision.signatureData != null) {
      map['signatureData'] = decision.signatureData;
    }
    if (decision.value != null) {
      map['value'] = decision.value;
    }

    // Sort keys alphabetically for canonical form
    final sorted = Map.fromEntries(
      map.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
    );

    // Encode with no whitespace
    return jsonEncode(sorted);
  }
}
