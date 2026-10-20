import 'enums.dart';

/// A participation request received from the Resolver.
class ParticipationRequest {
  final String requestId;
  final String appId;
  final String appName;
  final String summary;
  final String? description;
  final String? rationale;
  final String? category;
  final RequestType type;
  final List<RequestOption>? options;
  final DateTime? expiry;
  final DateTime receivedAt;
  final RequestStatus status;
  final DateTime? resolvedAt;
  final String? resolvedBy;
  final String? transactionId;
  final String? transactionLabel;

  const ParticipationRequest({
    required this.requestId,
    required this.appId,
    this.appName = '',
    required this.summary,
    this.description,
    this.rationale,
    this.category,
    required this.type,
    this.options,
    this.expiry,
    required this.receivedAt,
    this.status = RequestStatus.pending,
    this.resolvedAt,
    this.resolvedBy,
    this.transactionId,
    this.transactionLabel,
  });

  /// Parse a server timestamp into a UTC [DateTime].
  ///
  /// Server times are UTC instants. Strings may arrive with a 'Z', an explicit
  /// offset, or (from some .NET serializers) no zone designator at all. A
  /// zone-less string must be interpreted as UTC — not the device's local zone —
  /// otherwise countdowns skew by the local UTC offset (Bug 4). Anything parsed
  /// is normalized with [DateTime.toUtc] so callers can compare against
  /// `DateTime.now().toUtc()` consistently.
  static DateTime? _parseUtc(Object? value) {
    if (value is! String || value.isEmpty) return null;
    final hasZone = value.endsWith('Z') ||
        RegExp(r'[+-]\d{2}:?\d{2}$').hasMatch(value);
    final normalized = hasZone ? value : '${value}Z';
    return DateTime.tryParse(normalized)?.toUtc();
  }

  /// Parse from API response map.
  factory ParticipationRequest.fromJson(Map<String, dynamic> json) {
    return ParticipationRequest(
      requestId: json['requestId'] as String? ?? json['id'] as String? ?? '',
      appId: json['appId'] as String? ?? '',
      appName: json['appName'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      description: json['description'] as String?,
      rationale: json['rationale'] as String?,
      category: json['category'] as String?,
      type: RequestType.fromString(json['type'] as String? ?? 'select'),
      options: (json['options'] as List<dynamic>?)
          ?.map((o) => RequestOption.fromJson(o as Map<String, dynamic>))
          .toList(),
      expiry: _parseUtc(json['expiry']),
      receivedAt: _parseUtc(json['receivedAt']) ?? DateTime.now().toUtc(),
      status: RequestStatus.fromString(json['status'] as String? ?? 'pending'),
      resolvedAt: _parseUtc(json['resolvedAt']),
      resolvedBy: json['resolvedBy'] as String?,
      transactionId: json['transactionId'] as String?,
      transactionLabel: json['transactionLabel'] as String?,
    );
  }

  ParticipationRequest copyWith({
    RequestStatus? status,
    DateTime? resolvedAt,
    String? resolvedBy,
  }) {
    return ParticipationRequest(
      requestId: requestId,
      appId: appId,
      appName: appName,
      summary: summary,
      description: description,
      rationale: rationale,
      category: category,
      type: type,
      options: options,
      expiry: expiry,
      receivedAt: receivedAt,
      status: status ?? this.status,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      resolvedBy: resolvedBy ?? this.resolvedBy,
      transactionId: transactionId,
      transactionLabel: transactionLabel,
    );
  }
}

/// A single option within a select/multiselect request.
class RequestOption {
  final String key;
  final String label;
  final bool freeText;
  final String? placeholder;

  const RequestOption({
    required this.key,
    required this.label,
    this.freeText = false,
    this.placeholder,
  });

  factory RequestOption.fromJson(Map<String, dynamic> json) {
    return RequestOption(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      freeText: json['freeText'] as bool? ?? false,
      placeholder: json['placeholder'] as String?,
    );
  }
}
