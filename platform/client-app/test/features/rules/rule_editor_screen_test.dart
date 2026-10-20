import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/rules/rule_editor_screen.dart';

void main() {
  Widget buildEditor({
    Map<String, dynamic>? existingRule,
    ThemeData? theme,
    void Function(Map<String, dynamic>)? onSave,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: RuleEditorScreen(
          existingRule: existingRule,
          onSave: onSave ?? (_) {},
        ),
      ),
    );
  }

  group('RuleEditorScreen', () {
    testWidgets('RuleEditor_NewRule_EmptyForm', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rule-name-field')), findsOneWidget);
      expect(find.byKey(const Key('rule-conditions-list')), findsOneWidget);
      expect(find.byKey(const Key('rule-auth-level')), findsOneWidget);
    });

    testWidgets('RuleEditor_EditRule_PopulatesFields', (tester) async {
      await tester.pumpWidget(buildEditor(existingRule: {
        'id': 'r1',
        'name': 'Low value orders',
        'authLevel': 'none',
        'conditions': [
          {'field': 'summary', 'operator': 'contains', 'value': 'pizza'},
        ],
      }));
      await tester.pumpAndSettle();

      // Name field should be populated
      final nameField = tester.widget<TextField>(find.byKey(const Key('rule-name-field')));
      expect(nameField.controller?.text, 'Low value orders');
    });

    testWidgets('RuleEditor_AddCondition_OpensSheet', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('rule-add-condition')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('condition-editor-sheet')), findsOneWidget);
    });

    testWidgets('RuleEditor_Save_MissingName_ShowsError', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      // Try to save without name
      await tester.tap(find.byKey(const Key('rule-save-button')));
      await tester.pumpAndSettle();

      expect(find.text('Name is required'), findsOneWidget);
    });

    testWidgets('RuleEditor_AutoRespond_ShowsConfigWhenEnabled', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      // Toggle auto-respond on
      await tester.tap(find.byKey(const Key('rule-auto-respond-toggle')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rule-auto-respond-config')), findsOneWidget);
    });

    testWidgets('ConditionEditor_Save_AddsToRule', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      // Open condition editor
      await tester.tap(find.byKey(const Key('rule-add-condition')));
      await tester.pumpAndSettle();

      // Fill in condition
      await tester.tap(find.byKey(const Key('condition-field-dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Summary').last);
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('condition-value-field')), 'pizza');
      await tester.pumpAndSettle();

      // Save condition
      await tester.tap(find.byKey(const Key('condition-save')));
      await tester.pumpAndSettle();

      // Should appear in conditions list
      expect(find.textContaining('pizza'), findsOneWidget);
    });
  });

  group('Golden tests - rule editor', () {
    testWidgets('rule_editor_empty_light', (tester) async {
      await tester.pumpWidget(buildEditor());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rule_editor_empty_light.png'),
      );
    });

    testWidgets('rule_editor_empty_dark', (tester) async {
      await tester.pumpWidget(buildEditor(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rule_editor_empty_dark.png'),
      );
    });

    testWidgets('rule_editor_with_conditions_light', (tester) async {
      await tester.pumpWidget(buildEditor(existingRule: {
        'id': 'r1',
        'name': 'Low value orders',
        'authLevel': 'none',
        'autoRespond': true,
        'conditions': [
          {'field': 'summary', 'operator': 'contains', 'value': 'pizza'},
          {'field': 'category', 'operator': 'equals', 'value': 'food'},
        ],
      }));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rule_editor_with_conditions_light.png'),
      );
    });

    testWidgets('rule_editor_with_conditions_dark', (tester) async {
      await tester.pumpWidget(buildEditor(
        existingRule: {
          'id': 'r1',
          'name': 'Low value orders',
          'authLevel': 'none',
          'conditions': [
            {'field': 'summary', 'operator': 'contains', 'value': 'pizza'},
          ],
        },
        theme: AppTheme.dark(),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/rule_editor_with_conditions_dark.png'),
      );
    });
  });
}
