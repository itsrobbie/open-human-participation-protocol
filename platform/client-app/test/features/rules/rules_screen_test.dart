import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/rules/rules_screen.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

void main() {
  Widget buildRules({
    List<Map<String, dynamic>> rules = const [],
    ThemeData? theme,
    VoidCallback? onFabTap,
  }) {
    final notifier = _TestRulesNotifier(rules: rules);
    return ProviderScope(
      overrides: [
        rulesProvider.overrideWith((ref) => notifier),
      ],
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: RulesScreen(onCreateTap: onFabTap),
      ),
    );
  }

  Map<String, dynamic> makeRule({
    String id = 'rule-1',
    String name = 'Low value orders',
    bool enabled = true,
    int priority = 1,
    String? appId,
  }) {
    return {
      'id': id,
      'name': name,
      'enabled': enabled,
      'priority': priority,
      'appId': appId,
    };
  }

  group('RulesScreen', () {
    testWidgets('Rules_WithRules_ShowsReorderableList', (tester) async {
      await tester.pumpWidget(buildRules(rules: [
        makeRule(id: 'r1', name: 'Low value', priority: 1),
        makeRule(id: 'r2', name: 'High value', priority: 2),
      ]));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rule-card-0')), findsOneWidget);
      expect(find.byKey(const Key('rule-card-1')), findsOneWidget);
      expect(find.text('Low value'), findsOneWidget);
      expect(find.text('High value'), findsOneWidget);
    });

    testWidgets('Rules_Empty_ShowsDefaultMessage', (tester) async {
      await tester.pumpWidget(buildRules());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rules-empty')), findsOneWidget);
      expect(find.text('No rules yet'), findsOneWidget);
    });

    testWidgets('Rules_ToggleEnabled_UpdatesRule', (tester) async {
      await tester.pumpWidget(buildRules(rules: [makeRule(enabled: true)]));
      await tester.pumpAndSettle();

      final toggle = find.byKey(const Key('rule-toggle-0'));
      expect(toggle, findsOneWidget);

      await tester.tap(toggle);
      await tester.pumpAndSettle();

      final sw = tester.widget<Switch>(toggle);
      expect(sw.value, isFalse);
    });

    testWidgets('Rules_SwipeDelete_ShowsConfirmation', (tester) async {
      await tester.pumpWidget(buildRules(rules: [makeRule()]));
      await tester.pumpAndSettle();

      // Tap delete button
      await tester.tap(find.byKey(const Key('rule-delete-0')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rule-delete-confirm')), findsOneWidget);
    });

    testWidgets('Rules_FAB_NavigatesToEditor', (tester) async {
      bool fabTapped = false;
      await tester.pumpWidget(buildRules(onFabTap: () => fabTapped = true));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('rules-fab')));
      await tester.pumpAndSettle();

      expect(fabTapped, isTrue);
    });
  });

  group('Golden tests - rules', () {
    testWidgets('rules_populated_light', (tester) async {
      await tester.pumpWidget(buildRules(rules: [
        makeRule(id: 'r1', name: 'Low value orders', priority: 1),
        makeRule(id: 'r2', name: 'Internal transfers', priority: 2, enabled: false),
        makeRule(id: 'r3', name: 'Document signing', priority: 3),
      ]));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rules_populated_light.png'),
      );
    });

    testWidgets('rules_populated_dark', (tester) async {
      await tester.pumpWidget(buildRules(
        rules: [
          makeRule(id: 'r1', name: 'Low value orders', priority: 1),
          makeRule(id: 'r2', name: 'Internal transfers', priority: 2),
        ],
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rules_populated_dark.png'),
      );
    });

    testWidgets('rules_empty_light', (tester) async {
      await tester.pumpWidget(buildRules());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rules_empty_light.png'),
      );
    });

    testWidgets('rules_empty_dark', (tester) async {
      await tester.pumpWidget(buildRules(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rules_empty_dark.png'),
      );
    });
  });
}

class _TestRulesNotifier extends RulesNotifier {
  _TestRulesNotifier({List<Map<String, dynamic>> rules = const []})
      : super(dataSource: _StaticRulesSource()) {
    state = RulesState(rules: rules);
  }

  @override
  Future<void> fetch() async {}

  @override
  Future<bool> delete(String id) async {
    state = state.copyWith(
      rules: state.rules.where((r) => r['id'] != id).toList(),
    );
    return true;
  }
}

class _StaticRulesSource implements RulesDataSource {
  @override
  Future<List<Map<String, dynamic>>> fetchRules() async => [];
  @override
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data) async => data;
  @override
  Future<Map<String, dynamic>> updateRule(String id, Map<String, dynamic> data) async =>
      {...data, 'id': id};
  @override
  Future<void> deleteRule(String id) async {}
}
