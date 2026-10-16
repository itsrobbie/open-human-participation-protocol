import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/app.dart';
import 'package:ohpp_client/features/login/login_screen.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          loginProvider.overrideWith((ref) {
            return LoginNotifier(onLogin: (_, __) async => false);
          }),
        ],
        child: const OhppApp(),
      ),
    );
    await tester.pumpAndSettle();

    // App starts unauthenticated, so GoRouter redirects to login
    expect(find.text('OHPP'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
  });
}
