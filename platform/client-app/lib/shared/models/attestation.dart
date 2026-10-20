/// The user's decision payload for a participation response.
class AttestationDecision {
  final String? selectedOption;
  final List<String>? selectedOptions;
  final String? value;
  final String? signatureData;

  const AttestationDecision({
    this.selectedOption,
    this.selectedOptions,
    this.value,
    this.signatureData,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (selectedOption != null) map['selectedOption'] = selectedOption;
    if (selectedOptions != null) map['selectedOptions'] = selectedOptions;
    if (value != null) map['value'] = value;
    if (signatureData != null) map['signatureData'] = signatureData;
    return map;
  }
}

/// A signed attestation ready for submission.
class SignedAttestation {
  final String requestId;
  final String attestationPayload;
  final String deviceSignature;
  final String deviceId;
  final DateTime signedAt;

  const SignedAttestation({
    required this.requestId,
    required this.attestationPayload,
    required this.deviceSignature,
    required this.deviceId,
    required this.signedAt,
  });
}
