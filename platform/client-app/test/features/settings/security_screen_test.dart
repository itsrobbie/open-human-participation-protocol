import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/settings/security_screen.dart';

void main() {
  Widget buildSecurity({
    String keyAlgorithm = 'ES256',
    String storageLevel = 'Secure Enclave',
    bool jailbroken = false,
    ThemeData? theme,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: SecurityScreen(
          keyAlgorithm: keyAlgorithm,
          storageLevel: storageLevel,
          jailbroken: jailbroken,
        ),
      ),
    );
  }

  group('SecurityScreen', () {
    testWidgets('Security_ShowsKeyAlgorithm', (tester) async {
      await tester.pumpWidget(buildSecurity());
      await tester.pumpAndSettle();

      expect(find.text('ES256'), findsOneWidget);
    });

    testWidgets('Security_ShowsStorageLevel', (tester) async {
      await tester.pumpWidget(buildSecurity());
      await tester.pumpAndSettle();

      expect(find.text('Secure Enclave'), findsOneWidget);
    });

    testWidgets('Security_RotateKey_ShowsConfirmation', (tester) async {
      await tester.pumpWidget(buildSecurity());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('security-rotate-key')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('rotate-key-dialog')), findsOneWidget);
      expect(find.text('Rotate signing key?'), findsOneWidget);
    });

    testWidgets('Security_JailbreakDetected_ShowsWarning', (tester) async {
      await tester.pumpWidget(buildSecurity(jailbroken: true));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('security-jailbreak-warning')), findsOneWidget);
    });
  });

  group('Golden tests - security', () {
    testWidgets('security_light', (tester) async {
      await tester.pumpWidget(buildSecurity());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/security_light.png'),
      );
    });

    testWidgets('security_dark', (tester) async {
      await tester.pumpWidget(buildSecurity(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/security_dark.png'),
      );
    });

    testWidgets('security_rotate_key_dialog_light', (tester) async {
      await tester.pumpWidget(buildSecurity());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('security-rotate-key')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/security_rotate_key_dialog_light.png'),
      );
    });

    testWidgets('security_rotate_key_dialog_dark', (tester) async {
      await tester.pumpWidget(buildSecurity(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('security-rotate-key')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/security_rotate_key_dialog_dark.png'),
      );
    });
  });
}
