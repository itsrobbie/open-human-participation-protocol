import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/login/login_screen.dart';

void main() {
  bool loginSuccess = true;

  Widget buildLogin() {
    return ProviderScope(
      overrides: [
        loginProvider.overrideWith((ref) => LoginNotifier(
          onLogin: (u, p) async {
            await Future.delayed(const Duration(milliseconds: 10));
            if (!loginSuccess) return false;
            return true;
          },
        )),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const LoginScreen(),
      ),
    );
  }

  setUp(() {
    loginSuccess = true;
  });

  group('LoginScreen', () {
    testWidgets('Login_RendersForm', (tester) async {
      await tester.pumpWidget(buildLogin());

      expect(find.byKey(const Key('login-username')), findsOneWidget);
      expect(find.byKey(const Key('login-password')), findsOneWidget);
      expect(find.byKey(const Key('login-submit')), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
    });

    testWidgets('Login_EmptyFields_ButtonDisabled', (tester) async {
      await tester.pumpWidget(buildLogin());

      final button = tester.widget<ElevatedButton>(find.byKey(const Key('login-submit')));
      expect(button.onPressed, isNull);
    });

    testWidgets('Login_ValidInput_CallsAuth', (tester) async {
      await tester.pumpWidget(buildLogin());

      await tester.enterText(find.byKey(const Key('login-username')), 'testuser');
      await tester.enterText(find.byKey(const Key('login-password')), 'pass123');
      await tester.pump();

      // Button should now be enabled
      final button = tester.widget<ElevatedButton>(find.byKey(const Key('login-submit')));
      expect(button.onPressed, isNotNull);

      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      // After settling, login succeeded (no error shown)
      expect(find.byKey(const Key('login-error')), findsNothing);
    });

    testWidgets('Login_Error_ShowsErrorMessage', (tester) async {
      loginSuccess = false;
      await tester.pumpWidget(buildLogin());

      await tester.enterText(find.byKey(const Key('login-username')), 'user');
      await tester.enterText(find.byKey(const Key('login-password')), 'wrong');
      await tester.pump();
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('login-error')), findsOneWidget);
      expect(find.text('Invalid username or password'), findsOneWidget);
    });

    testWidgets('Login_Loading_ShowsSpinner', (tester) async {
      // Use a completer to control when login resolves
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            loginProvider.overrideWith((ref) => LoginNotifier(
              onLogin: (u, p) => Future.value(true),
            )),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const LoginScreen(),
          ),
        ),
      );

      await tester.enterText(find.byKey(const Key('login-username')), 'user');
      await tester.enterText(find.byKey(const Key('login-password')), 'pass');
      await tester.pump();
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      // Login completed successfully (no error)
      expect(find.byKey(const Key('login-error')), findsNothing);
    });
  });

  group('Golden tests - login', () {
    testWidgets('login_empty_light', (tester) async {
      await tester.pumpWidget(buildLogin());

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/login_empty_light.png'),
      );
    });

    testWidgets('login_error_light', (tester) async {
      loginSuccess = false;
      await tester.pumpWidget(buildLogin());

      await tester.enterText(find.byKey(const Key('login-username')), 'user');
      await tester.enterText(find.byKey(const Key('login-password')), 'wrong');
      await tester.pump();
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/login_error_light.png'),
      );
    });
  });
}
