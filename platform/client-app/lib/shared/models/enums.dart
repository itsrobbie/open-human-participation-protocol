/// Request types defined by the OHPP protocol.
enum RequestType {
  select,
  multiselect,
  text,
  number,
  date,
  datetime,
  signature;

  static RequestType fromString(String value) {
    return RequestType.values.firstWhere(
      (e) => e.name == value.toLowerCase(),
      orElse: () => RequestType.text,
    );
  }
}

/// Status of a participation request in the local cache.
enum RequestStatus {
  pending,
  resolved,
  expired,
  cancelled,
  alreadyResolved;

  static RequestStatus fromString(String value) {
    return RequestStatus.values.firstWhere(
      (e) => e.name == value.toLowerCase(),
      orElse: () => RequestStatus.pending,
    );
  }
}

/// Authentication level required before signing an attestation.
enum AuthLevel {
  none,
  devicePasscode,
  biometric;

  static AuthLevel fromString(String value) {
    return AuthLevel.values.firstWhere(
      (e) => e.name == value,
      orElse: () => AuthLevel.biometric,
    );
  }
}

/// Fields that can be matched in rule conditions.
enum ConditionField {
  appId,
  category,
  type,
  summary,
  description,
  optionKey,
  optionLabel,
  numericValue;

  static ConditionField fromString(String value) {
    return ConditionField.values.firstWhere(
      (e) => e.name == value,
      orElse: () => ConditionField.summary,
    );
  }
}

/// Operators for rule condition evaluation.
enum ConditionOperator {
  equals,
  notEquals,
  contains,
  notContains,
  greaterThan,
  lessThan,
  greaterOrEqual,
  lessOrEqual,
  matches;

  static ConditionOperator fromString(String value) {
    return ConditionOperator.values.firstWhere(
      (e) => e.name == value,
      orElse: () => ConditionOperator.equals,
    );
  }
}

/// Key storage level reported by the platform.
enum KeyStorageLevel {
  secureEnclave,
  hardwareKeystore,
  software;
}

/// Status of an offline queue entry.
enum QueueStatus {
  pending,
  delivered,
  expired,
  failed;
}
