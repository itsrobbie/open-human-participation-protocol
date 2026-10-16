import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/pending/request_detail_sheet.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/shared/models/participation_request.dart';

void main() {
  Widget buildSheet({
    required ParticipationRequest request,
    bool alreadyResolved = false,
    ThemeData? theme,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => RequestDetailSheet(
                    request: request,
                    alreadyResolved: alreadyResolved,
                    onSubmit: (_) {},
                  ),
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> openSheet(WidgetTester tester) async {
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
  }

  ParticipationRequest makeRequest({
    RequestType type = RequestType.select,
    List<RequestOption>? options,
    String? description,
    DateTime? expiry,
  }) {
    return ParticipationRequest(
      requestId: 'req-001',
      appId: 'pizza.example.com',
      appName: 'Pizza App',
      summary: 'Approve order for \$45.00',
      description: description,
      type: type,
      options: options ??
          [
            const RequestOption(key: 'approve', label: 'Approve'),
            const RequestOption(key: 'deny', label: 'Deny'),
            const RequestOption(key: 'escalate', label: 'Escalate'),
          ],
      expiry: expiry,
      receivedAt: DateTime.now(),
    );
  }

  group('RequestDetailSheet - Select type', () {
    testWidgets('Detail_SelectType_ShowsChoiceChips', (tester) async {
      await tester.pumpWidget(buildSheet(request: makeRequest()));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-select')), findsOneWidget);
      expect(find.text('Approve'), findsOneWidget);
      expect(find.text('Deny'), findsOneWidget);
      expect(find.text('Escalate'), findsOneWidget);
    });

    testWidgets('Detail_Submit_NoSelection_DisabledButton', (tester) async {
      await tester.pumpWidget(buildSheet(request: makeRequest()));
      await openSheet(tester);

      final submitButton = find.byKey(const Key('detail-submit'));
      expect(submitButton, findsOneWidget);
      // Button should be disabled (onPressed is null)
      final button = tester.widget<ElevatedButton>(submitButton);
      expect(button.onPressed, isNull);
    });

    testWidgets('Detail_Submit_WithSelection_TriggersAuth', (tester) async {
      bool submitted = false;
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => RequestDetailSheet(
                      request: makeRequest(),
                      onSubmit: (_) => submitted = true,
                    ),
                  );
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ));
      await openSheet(tester);

      // Select an option
      await tester.tap(find.text('Approve'));
      await tester.pumpAndSettle();

      // Submit should now be enabled
      final submitButton = find.byKey(const Key('detail-submit'));
      final button = tester.widget<ElevatedButton>(submitButton);
      expect(button.onPressed, isNotNull);

      await tester.tap(submitButton);
      await tester.pumpAndSettle();
      expect(submitted, isTrue);
    });
  });

  group('RequestDetailSheet - Multiselect type', () {
    testWidgets('Detail_MultiselectType_ShowsFilterChips', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(
          type: RequestType.multiselect,
          options: [
            const RequestOption(key: 'tomato', label: 'Tomato'),
            const RequestOption(key: 'cheese', label: 'Cheese'),
            const RequestOption(key: 'basil', label: 'Basil'),
          ],
        ),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-multiselect')), findsOneWidget);
      expect(find.text('Tomato'), findsOneWidget);
      expect(find.text('Cheese'), findsOneWidget);
      expect(find.text('Basil'), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Text type', () {
    testWidgets('Detail_TextType_ShowsTextField', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(type: RequestType.text, options: []),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-text')), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Number type', () {
    testWidgets('Detail_NumberType_ShowsNumericInput', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(type: RequestType.number, options: []),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-number')), findsOneWidget);
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.keyboardType, TextInputType.number);
    });
  });

  group('RequestDetailSheet - Date type', () {
    testWidgets('Detail_DateType_ShowsDatePicker', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(type: RequestType.date, options: []),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-date')), findsOneWidget);
      expect(find.text('Select date'), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Datetime type', () {
    testWidgets('Detail_DatetimeType_ShowsDatetimePicker', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(type: RequestType.datetime, options: []),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-datetime')), findsOneWidget);
      expect(find.text('Select date and time'), findsOneWidget);
      expect(find.text('Date'), findsOneWidget);
      expect(find.text('Time'), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Signature type', () {
    testWidgets('Detail_SignatureType_ShowsCanvas', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(type: RequestType.signature, options: []),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('response-input-signature')), findsOneWidget);
      expect(find.text('Draw your signature'), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Markdown', () {
    testWidgets('Detail_WithMarkdown_RendersFormatted', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(
          description: '**Bold text** and _italic text_',
        ),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('detail-description')), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Expiry', () {
    testWidgets('Detail_WithExpiry_ShowsCountdown', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(
          expiry: DateTime.now().add(const Duration(minutes: 10)),
        ),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('detail-expiry')), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Already resolved', () {
    testWidgets('Detail_AlreadyResolved_ShowsBanner', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(),
        alreadyResolved: true,
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('detail-resolved-banner')), findsOneWidget);
      expect(find.text('Already resolved'), findsOneWidget);
    });
  });

  group('RequestDetailSheet - Test IDs', () {
    testWidgets('Detail_TestIds_AllPresent', (tester) async {
      await tester.pumpWidget(buildSheet(
        request: makeRequest(
          description: 'Test description',
          expiry: DateTime.now().add(const Duration(hours: 1)),
        ),
      ));
      await openSheet(tester);

      expect(find.byKey(const Key('detail-header')), findsOneWidget);
      expect(find.byKey(const Key('detail-summary')), findsOneWidget);
      expect(find.byKey(const Key('detail-description')), findsOneWidget);
      expect(find.byKey(const Key('detail-expiry')), findsOneWidget);
      expect(find.byKey(const Key('detail-submit')), findsOneWidget);
      expect(find.byKey(const Key('response-input-select')), findsOneWidget);
    });
  });

  group('Golden tests - request detail', () {
    testWidgets('request_detail_select_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_select_light.png'),
      );
    });

    testWidgets('request_detail_select_dark', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.dark(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_select_dark.png'),
      );
    });

    testWidgets('request_detail_multiselect_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(
                type: RequestType.multiselect,
                options: [
                  const RequestOption(key: 'a', label: 'Option A'),
                  const RequestOption(key: 'b', label: 'Option B'),
                  const RequestOption(key: 'c', label: 'Option C'),
                ],
              ),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_multiselect_light.png'),
      );
    });

    testWidgets('request_detail_text_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(type: RequestType.text, options: []),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_text_light.png'),
      );
    });

    testWidgets('request_detail_number_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(type: RequestType.number, options: []),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_number_light.png'),
      );
    });

    testWidgets('request_detail_signature_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(type: RequestType.signature, options: []),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_signature_light.png'),
      );
    });

    testWidgets('request_detail_already_resolved_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(),
              alreadyResolved: true,
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_already_resolved_light.png'),
      );
    });

    testWidgets('request_detail_with_markdown_light', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: RequestDetailSheet(
              request: makeRequest(
                description: '**Important**: Please review the order details.\n\n- Item: Margherita Pizza\n- Quantity: 2\n- Total: \$45.00',
              ),
              onSubmit: (_) {},
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/request_detail_with_markdown_light.png'),
      );
    });
  });
}
