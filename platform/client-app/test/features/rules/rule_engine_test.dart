import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';
import 'package:ohpp_client/shared/models/models.dart';

void main() {
  late RuleEngine engine;

  setUp(() {
    engine = RuleEngine();
  });

  ParticipationRequest makeRequest({
    String appId = 'pizza.test',
    String summary = 'Approve order for \$45.00',
    String? category,
    RequestType type = RequestType.select,
    List<RequestOption>? options,
    String? description,
  }) {
    return ParticipationRequest(
      requestId: 'req-1',
      appId: appId,
      summary: summary,
      category: category,
      type: type,
      options: options,
      description: description,
      receivedAt: DateTime.now(),
    );
  }

  ParticipationRule makeRule({
    String id = 'rule-1',
    String? appId,
    int priority = 1,
    AuthLevel authLevel = AuthLevel.none,
    bool enabled = true,
    bool autoRespondEnabled = false,
    String? autoRespondOption,
    List<RuleCondition> conditions = const [],
  }) {
    return ParticipationRule(
      id: id,
      name: 'Test Rule',
      appId: appId,
      priority: priority,
      authLevel: authLevel,
      enabled: enabled,
      autoRespondEnabled: autoRespondEnabled,
      autoRespondOption: autoRespondOption,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      conditions: conditions,
    );
  }

  RuleCondition makeCondition({
    ConditionField field = ConditionField.category,
    ConditionOperator operator = ConditionOperator.equals,
    String value = 'payment',
  }) {
    return RuleCondition(
      id: 'cond-1',
      ruleId: 'rule-1',
      field: field,
      operator: operator,
      value: value,
    );
  }

  // --- Happy path ---

  group('Default behavior', () {
    test('evaluate_NoRules_ReturnsDefaultBiometric', () {
      final result = engine.evaluate(makeRequest(), []);

      expect(result.matchedRule, isNull);
      expect(result.authLevel, equals(AuthLevel.biometric));
      expect(result.autoRespond, isNull);
    });

    test('evaluate_EmptyRulesList_ReturnsDefault', () {
      final result = engine.evaluate(makeRequest(), []);

      expect(result.authLevel, equals(AuthLevel.biometric));
    });
  });

  group('Basic matching', () {
    test('evaluate_SingleMatchingRule_ReturnsRuleAuthLevel', () {
      final rule = makeRule(authLevel: AuthLevel.none);
      final result = engine.evaluate(makeRequest(), [rule]);

      expect(result.matchedRule, equals(rule));
      expect(result.authLevel, equals(AuthLevel.none));
    });

    test('evaluate_MultipleRules_FirstMatchByPriorityWins', () {
      final rule1 = makeRule(id: 'r1', priority: 2, authLevel: AuthLevel.devicePasscode);
      final rule2 = makeRule(id: 'r2', priority: 1, authLevel: AuthLevel.none);

      final result = engine.evaluate(makeRequest(), [rule1, rule2]);

      expect(result.matchedRule!.id, equals('r2'));
      expect(result.authLevel, equals(AuthLevel.none));
    });

    test('evaluate_PriorityOrdering_LowerNumberFirst', () {
      final rules = [
        makeRule(id: 'r3', priority: 3, authLevel: AuthLevel.biometric),
        makeRule(id: 'r1', priority: 1, authLevel: AuthLevel.none),
        makeRule(id: 'r2', priority: 2, authLevel: AuthLevel.devicePasscode),
      ];

      final result = engine.evaluate(makeRequest(), rules);

      expect(result.matchedRule!.id, equals('r1'));
    });

    test('evaluate_RuleWithNullAppId_MatchesAllApps', () {
      final rule = makeRule(appId: null, authLevel: AuthLevel.none);

      final result = engine.evaluate(makeRequest(appId: 'anything.test'), [rule]);

      expect(result.matchedRule, equals(rule));
    });

    test('evaluate_AutoRespondEnabled_ReturnsAutoConfig', () {
      final rule = makeRule(
        autoRespondEnabled: true,
        autoRespondOption: 'approve',
      );

      final result = engine.evaluate(makeRequest(), [rule]);

      expect(result.autoRespond, isNotNull);
      expect(result.autoRespond!.enabled, isTrue);
      expect(result.autoRespond!.selectedOption, equals('approve'));
    });
  });

  group('Condition evaluation', () {
    test('evaluate_AllConditionsPass_RuleMatches', () {
      final rule = makeRule(
        appId: 'pizza.test',
        conditions: [
          makeCondition(field: ConditionField.category, operator: ConditionOperator.equals, value: 'order'),
        ],
      );

      final result = engine.evaluate(makeRequest(category: 'order'), [rule]);

      expect(result.matchedRule, equals(rule));
    });

    test('evaluate_EqualsOperator_ExactMatch', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.category, operator: ConditionOperator.equals, value: 'payment'),
      ]);

      final match = engine.evaluate(makeRequest(category: 'payment'), [rule]);
      final noMatch = engine.evaluate(makeRequest(category: 'order'), [rule]);

      expect(match.matchedRule, isNotNull);
      expect(noMatch.matchedRule, isNull);
    });

    test('evaluate_ContainsOperator_SubstringMatch', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.summary, operator: ConditionOperator.contains, value: 'order'),
      ]);

      final match = engine.evaluate(makeRequest(summary: 'Approve order for pizza'), [rule]);
      final noMatch = engine.evaluate(makeRequest(summary: 'Transfer money'), [rule]);

      expect(match.matchedRule, isNotNull);
      expect(noMatch.matchedRule, isNull);
    });

    test('evaluate_GreaterThanOperator_NumericComparison', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '30'),
      ]);

      final match = engine.evaluate(makeRequest(summary: 'Order for \$45.00'), [rule]);
      final noMatch = engine.evaluate(makeRequest(summary: 'Order for \$20.00'), [rule]);

      expect(match.matchedRule, isNotNull);
      expect(noMatch.matchedRule, isNull);
    });

    test('evaluate_LessThanOperator_NumericComparison', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.lessThan, value: '50'),
      ]);

      final match = engine.evaluate(makeRequest(summary: 'Pay \$30'), [rule]);
      final noMatch = engine.evaluate(makeRequest(summary: 'Pay \$100'), [rule]);

      expect(match.matchedRule, isNotNull);
      expect(noMatch.matchedRule, isNull);
    });

    test('evaluate_GreaterOrEqual_BoundaryValue', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterOrEqual, value: '30'),
      ]);

      final exactMatch = engine.evaluate(makeRequest(summary: 'Pay \$30'), [rule]);
      final above = engine.evaluate(makeRequest(summary: 'Pay \$31'), [rule]);
      final below = engine.evaluate(makeRequest(summary: 'Pay \$29'), [rule]);

      expect(exactMatch.matchedRule, isNotNull);
      expect(above.matchedRule, isNotNull);
      expect(below.matchedRule, isNull);
    });

    test('evaluate_MatchesOperator_RegexMatch', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.summary, operator: ConditionOperator.matches, value: r'order.*pizza'),
      ]);

      final match = engine.evaluate(makeRequest(summary: 'order a large pizza'), [rule]);
      final noMatch = engine.evaluate(makeRequest(summary: 'transfer money'), [rule]);

      expect(match.matchedRule, isNotNull);
      expect(noMatch.matchedRule, isNull);
    });

    test('evaluate_NumericExtraction_FromSummaryText', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '100'),
      ]);

      final result = engine.evaluate(makeRequest(summary: 'Transfer 150.50 to account'), [rule]);

      expect(result.matchedRule, isNotNull);
    });

    test('evaluate_NumericExtraction_CurrencySymbolStripped', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '40'),
      ]);

      final dollar = engine.evaluate(makeRequest(summary: 'Pay \$45.00'), [rule]);
      final euro = engine.evaluate(makeRequest(summary: 'Pay €50'), [rule]);
      final pound = engine.evaluate(makeRequest(summary: 'Pay £42'), [rule]);

      expect(dollar.matchedRule, isNotNull);
      expect(euro.matchedRule, isNotNull);
      expect(pound.matchedRule, isNotNull);
    });

    test('evaluate_NumericExtraction_CommasStripped', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '1000'),
      ]);

      final result = engine.evaluate(makeRequest(summary: 'Transfer \$1,500.00'), [rule]);

      expect(result.matchedRule, isNotNull);
    });
  });

  // --- Non-happy path ---

  group('Non-matching scenarios', () {
    test('evaluate_RuleAppIdMismatch_Skipped', () {
      final rule = makeRule(appId: 'bank.test', authLevel: AuthLevel.none);

      final result = engine.evaluate(makeRequest(appId: 'pizza.test'), [rule]);

      expect(result.matchedRule, isNull);
      expect(result.authLevel, equals(AuthLevel.biometric));
    });

    test('evaluate_OneConditionFails_RuleSkipped', () {
      final rule = makeRule(
        conditions: [
          makeCondition(field: ConditionField.category, operator: ConditionOperator.equals, value: 'payment'),
          makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '100'),
        ],
      );

      // Category matches but amount doesn't
      final result = engine.evaluate(
        makeRequest(category: 'payment', summary: 'Pay \$20'),
        [rule],
      );

      expect(result.matchedRule, isNull);
    });

    test('evaluate_ConditionFieldMissing_ConditionNotMet', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.category, operator: ConditionOperator.equals, value: 'payment'),
      ]);

      // Request has no category
      final result = engine.evaluate(makeRequest(category: null), [rule]);

      expect(result.matchedRule, isNull);
    });

    test('evaluate_NumericExtraction_NoNumber_ConditionNotMet', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.numericValue, operator: ConditionOperator.greaterThan, value: '10'),
      ]);

      final result = engine.evaluate(makeRequest(summary: 'Approve this action'), [rule]);

      expect(result.matchedRule, isNull);
    });

    test('evaluate_InvalidRegex_ConditionNotMet', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.summary, operator: ConditionOperator.matches, value: r'[invalid'),
      ]);

      final result = engine.evaluate(makeRequest(), [rule]);

      expect(result.matchedRule, isNull);
    });

    test('evaluate_DisabledRule_Skipped', () {
      final rule = makeRule(enabled: false, authLevel: AuthLevel.none);

      final result = engine.evaluate(makeRequest(), [rule]);

      expect(result.matchedRule, isNull);
      expect(result.authLevel, equals(AuthLevel.biometric));
    });

    test('evaluate_NullRequestCategory_CategoryConditionNotMet', () {
      final rule = makeRule(conditions: [
        makeCondition(field: ConditionField.category, operator: ConditionOperator.equals, value: 'anything'),
      ]);

      final result = engine.evaluate(makeRequest(category: null), [rule]);

      expect(result.matchedRule, isNull);
    });
  });

  group('Auto-respond', () {
    test('evaluate_AutoRespondDisabled_ReturnsNull', () {
      final rule = makeRule(autoRespondEnabled: false);

      final result = engine.evaluate(makeRequest(), [rule]);

      expect(result.autoRespond, isNull);
    });
  });
}
