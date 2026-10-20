import 'package:ohpp_client/shared/models/models.dart';

/// Result of evaluating participation rules against a request.
class RuleResult {
  final ParticipationRule? matchedRule;
  final AuthLevel authLevel;
  final AutoRespondConfig? autoRespond;

  const RuleResult({
    this.matchedRule,
    required this.authLevel,
    this.autoRespond,
  });
}

/// Auto-respond configuration extracted from a matched rule.
class AutoRespondConfig {
  final bool enabled;
  final String? selectedOption;
  final String? value;

  const AutoRespondConfig({
    required this.enabled,
    this.selectedOption,
    this.value,
  });
}

/// Evaluates participation rules against incoming requests.
/// First matching rule (by priority) wins. Default: biometric auth, no auto-respond.
class RuleEngine {
  /// Evaluate all enabled rules against the request.
  /// Rules are sorted by priority (ascending) before evaluation.
  /// First rule where all conditions match wins.
  RuleResult evaluate(ParticipationRequest request, List<ParticipationRule> rules) {
    // Sort by priority ascending (lower number = higher priority)
    final sorted = List<ParticipationRule>.from(rules)
      ..sort((a, b) => a.priority.compareTo(b.priority));

    for (final rule in sorted) {
      if (!rule.enabled) continue;

      // App ID filter
      if (rule.appId != null && rule.appId != request.appId) continue;

      // All conditions must pass (AND logic)
      if (!_allConditionsMatch(rule.conditions, request)) continue;

      // Rule matches
      return RuleResult(
        matchedRule: rule,
        authLevel: rule.authLevel,
        autoRespond: rule.autoRespondEnabled
            ? AutoRespondConfig(
                enabled: true,
                selectedOption: rule.autoRespondOption,
                value: rule.autoRespondValue,
              )
            : null,
      );
    }

    // No rule matched: default behavior
    return const RuleResult(
      matchedRule: null,
      authLevel: AuthLevel.biometric,
      autoRespond: null,
    );
  }

  bool _allConditionsMatch(List<RuleCondition> conditions, ParticipationRequest request) {
    for (final condition in conditions) {
      if (!_evaluateCondition(condition, request)) return false;
    }
    return true;
  }

  bool _evaluateCondition(RuleCondition condition, ParticipationRequest request) {
    final fieldValue = _extractFieldValue(condition.field, request);

    // Special handling for numericValue
    if (condition.field == ConditionField.numericValue) {
      return _evaluateNumericCondition(condition.operator, request, condition.value);
    }

    // Field not present on request: condition not met
    if (fieldValue == null) return false;

    return _applyOperator(condition.operator, fieldValue, condition.value);
  }

  String? _extractFieldValue(ConditionField field, ParticipationRequest request) {
    switch (field) {
      case ConditionField.appId:
        return request.appId;
      case ConditionField.category:
        return request.category;
      case ConditionField.type:
        return request.type.name;
      case ConditionField.summary:
        return request.summary;
      case ConditionField.description:
        return request.description;
      case ConditionField.optionKey:
        return request.options?.map((o) => o.key).join(',');
      case ConditionField.optionLabel:
        return request.options?.map((o) => o.label).join(',');
      case ConditionField.numericValue:
        return null; // Handled separately
    }
  }

  bool _evaluateNumericCondition(ConditionOperator op, ParticipationRequest request, String conditionValue) {
    final extracted = _extractNumericValue(request.summary);
    if (extracted == null) return false;

    final threshold = double.tryParse(conditionValue);
    if (threshold == null) return false;

    switch (op) {
      case ConditionOperator.greaterThan:
        return extracted > threshold;
      case ConditionOperator.lessThan:
        return extracted < threshold;
      case ConditionOperator.greaterOrEqual:
        return extracted >= threshold;
      case ConditionOperator.lessOrEqual:
        return extracted <= threshold;
      case ConditionOperator.equals:
        return extracted == threshold;
      case ConditionOperator.notEquals:
        return extracted != threshold;
      default:
        return false;
    }
  }

  /// Extract the first numeric value from text, stripping currency symbols and commas.
  double? _extractNumericValue(String text) {
    // Strip currency symbols and commas
    final cleaned = text.replaceAll(RegExp(r'[\$€£¥₹,]'), '');

    // Find the first number (integer or decimal)
    final match = RegExp(r'(\d+\.?\d*)').firstMatch(cleaned);
    if (match == null) return null;

    return double.tryParse(match.group(1)!);
  }

  bool _applyOperator(ConditionOperator op, String fieldValue, String conditionValue) {
    switch (op) {
      case ConditionOperator.equals:
        return fieldValue == conditionValue;
      case ConditionOperator.notEquals:
        return fieldValue != conditionValue;
      case ConditionOperator.contains:
        return fieldValue.toLowerCase().contains(conditionValue.toLowerCase());
      case ConditionOperator.notContains:
        return !fieldValue.toLowerCase().contains(conditionValue.toLowerCase());
      case ConditionOperator.matches:
        try {
          return RegExp(conditionValue).hasMatch(fieldValue);
        } catch (_) {
          return false; // Invalid regex: condition not met
        }
      case ConditionOperator.greaterThan:
      case ConditionOperator.lessThan:
      case ConditionOperator.greaterOrEqual:
      case ConditionOperator.lessOrEqual:
        // These are for numeric fields only, handled above
        return false;
    }
  }
}
