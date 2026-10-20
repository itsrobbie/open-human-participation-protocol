import 'enums.dart';

/// A user-defined rule that controls authentication and auto-respond behavior.
class ParticipationRule {
  final String id;
  final String name;
  final String? appId;
  final int priority;
  final AuthLevel authLevel;
  final bool autoRespondEnabled;
  final String? autoRespondOption;
  final String? autoRespondValue;
  final bool enabled;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<RuleCondition> conditions;

  const ParticipationRule({
    required this.id,
    required this.name,
    this.appId,
    required this.priority,
    required this.authLevel,
    this.autoRespondEnabled = false,
    this.autoRespondOption,
    this.autoRespondValue,
    this.enabled = true,
    required this.createdAt,
    required this.updatedAt,
    this.conditions = const [],
  });
}

/// A single condition within a rule (AND logic with other conditions).
class RuleCondition {
  final String id;
  final String ruleId;
  final ConditionField field;
  final ConditionOperator operator;
  final String value;

  const RuleCondition({
    required this.id,
    required this.ruleId,
    required this.field,
    required this.operator,
    required this.value,
  });
}
