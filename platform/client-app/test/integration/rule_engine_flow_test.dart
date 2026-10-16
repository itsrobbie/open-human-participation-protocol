import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/shared/models/participation_request.dart';
import 'package:ohpp_client/shared/models/participation_rule.dart';

import 'mock_resolver.dart';

/// Step 48: Rule engine flow integration tests.
void main() {
  late MockResolver resolver;
  late RuleEngine ruleEngine;

  setUp(() {
    resolver = MockResolver();
    ruleEngine = RuleEngine();
  });

  ParticipationRequest makeRequest({
    String appId = 'pizza.example.com',
    String summary = 'Approve order for \$15.00',
    String? category = 'food',
    RequestType type = RequestType.select,
  }) {
    return ParticipationRequest(
      requestId: 'req-001',
      appId: appId,
      summary: summary,
      category: category,
      type: type,
      receivedAt: DateTime.now(),
    );
  }

  ParticipationRule makeRule({
    String id = 'rule-1',
    String name = 'Low value',
    bool enabled = true,
    int priority = 1,
    String? appId,
    AuthLevel authLevel = AuthLevel.none,
    bool autoRespondEnabled = false,
    String? autoRespondOption,
    List<RuleCondition> conditions = const [],
  }) {
    final now = DateTime.now();
    return ParticipationRule(
      id: id,
      name: name,
      enabled: enabled,
      priority: priority,
      appId: appId,
      authLevel: authLevel,
      autoRespondEnabled: autoRespondEnabled,
      autoRespondOption: autoRespondOption,
      createdAt: now,
      updatedAt: now,
      conditions: conditions,
    );
  }

  RuleCondition makeCondition({
    ConditionField field = ConditionField.appId,
    ConditionOperator operator = ConditionOperator.equals,
    String value = 'pizza.example.com',
  }) {
    return RuleCondition(
      id: 'cond-1',
      ruleId: 'rule-1',
      field: field,
      operator: operator,
      value: value,
    );
  }

  group('Rule Engine Flow', () {
    test('integration_Rule_Create_AppearsInList', () {
      final created = resolver.createRule({
        'name': 'Low value orders',
        'enabled': true,
        'priority': 1,
      });

      expect(created['id'], isNotEmpty);
      expect(resolver.rules.length, 1);
      expect(resolver.rules.first['name'], 'Low value orders');
    });

    test('integration_Rule_MatchingRequest_AppliesAuthLevel', () {
      final rules = [
        makeRule(
          name: 'Pizza rule',
          authLevel: AuthLevel.none,
          conditions: [
            makeCondition(
              field: ConditionField.appId,
              operator: ConditionOperator.equals,
              value: 'pizza.example.com',
            ),
          ],
        ),
      ];

      final result = ruleEngine.evaluate(makeRequest(), rules);

      expect(result.matchedRule, isNotNull);
      expect(result.authLevel, AuthLevel.none);
    });

    test('integration_Rule_NoneAuth_SkipsBiometric', () {
      final rules = [
        makeRule(authLevel: AuthLevel.none, conditions: [
          makeCondition(
            field: ConditionField.category,
            operator: ConditionOperator.equals,
            value: 'food',
          ),
        ]),
      ];

      final result = ruleEngine.evaluate(makeRequest(), rules);

      expect(result.authLevel, AuthLevel.none);
    });

    test('integration_Rule_BiometricAuth_RequiresBiometric', () {
      final rules = [
        makeRule(authLevel: AuthLevel.biometric, conditions: [
          makeCondition(
            field: ConditionField.category,
            operator: ConditionOperator.equals,
            value: 'food',
          ),
        ]),
      ];

      final result = ruleEngine.evaluate(makeRequest(), rules);

      expect(result.authLevel, AuthLevel.biometric);
    });

    test('integration_Rule_AutoRespond_SubmitsAutomatically', () {
      final rules = [
        makeRule(autoRespondEnabled: true, autoRespondOption: 'approve', conditions: [
          makeCondition(
            field: ConditionField.category,
            operator: ConditionOperator.equals,
            value: 'food',
          ),
        ]),
      ];

      final result = ruleEngine.evaluate(makeRequest(), rules);

      expect(result.matchedRule, isNotNull);
      expect(result.autoRespond, isNotNull);
      expect(result.autoRespond!.enabled, isTrue);
    });

    test('integration_Rule_Reorder_UpdatesPriority', () {
      resolver.createRule({'id': 'r1', 'name': 'Rule A', 'priority': 1});
      resolver.createRule({'id': 'r2', 'name': 'Rule B', 'priority': 2});
      resolver.createRule({'id': 'r3', 'name': 'Rule C', 'priority': 3});

      resolver.reorderRules(['r3', 'r1', 'r2']);

      expect(resolver.rules[0]['name'], 'Rule C');
      expect(resolver.rules[1]['name'], 'Rule A');
      expect(resolver.rules[2]['name'], 'Rule B');
    });

    test('integration_Rule_Delete_RemovedFromList', () {
      resolver.createRule({'id': 'r1', 'name': 'To delete', 'priority': 1});
      expect(resolver.rules.length, 1);

      resolver.deleteRule('r1');
      expect(resolver.rules, isEmpty);
    });

    test('integration_Rule_SyncsToServer', () {
      final rule = resolver.createRule({
        'name': 'Sync test',
        'enabled': true,
        'priority': 1,
        'conditions': [
          {'field': 'summary', 'operator': 'contains', 'value': 'test'},
        ],
      });

      final serverRules = resolver.getRules();
      expect(serverRules.any((r) => r['id'] == rule['id']), isTrue);
    });
  });
}
