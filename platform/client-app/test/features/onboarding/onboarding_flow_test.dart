import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/onboarding/onboarding_flow.dart';
import 'package:ohpp_client/shared/providers/telemetry_provider.dart';

void main() {
  bool onboardingCompleted = false;

  Widget buildOnboarding() {
    onboardingCompleted = false;
    return ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: OnboardingFlow(onComplete: () => onboardingCompleted = true),
      ),
    );
  }

  group('OnboardingFlow', () {
    testWidgets('Onboarding_CompletesAllScreens_NavigatesToLogin', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      // Page 1 (Welcome)
      expect(find.byKey(const Key('onboarding-welcome')), findsOneWidget);

      // Navigate through all pages
      await tester.tap(find.byKey(const Key('onboarding-next')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('onboarding-how-it-works')), findsOneWidget);

      await tester.tap(find.byKey(const Key('onboarding-next')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('onboarding-security')), findsOneWidget);

      await tester.tap(find.byKey(const Key('onboarding-next')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('onboarding-get-started')), findsOneWidget);

      // Tap "Log In" button
      await tester.tap(find.byKey(const Key('onboarding-login')));
      await tester.pumpAndSettle();

      expect(onboardingCompleted, isTrue);
    });

    testWidgets('Onboarding_TelemetryToggle_DefaultEnabled', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      // Navigate to last page
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const Key('onboarding-next')));
        await tester.pumpAndSettle();
      }

      final toggle = tester.widget<SwitchListTile>(find.byKey(const Key('onboarding-telemetry-toggle')));
      expect(toggle.value, isTrue);
    });

    testWidgets('Onboarding_TelemetryToggle_CanDisable', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      // Navigate to last page
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const Key('onboarding-next')));
        await tester.pumpAndSettle();
      }

      // Toggle off
      await tester.tap(find.byKey(const Key('onboarding-telemetry-toggle')));
      await tester.pumpAndSettle();

      final toggle = tester.widget<SwitchListTile>(find.byKey(const Key('onboarding-telemetry-toggle')));
      expect(toggle.value, isFalse);
    });

    testWidgets('Onboarding_BackButton_NavigatesBack', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      // Go forward
      await tester.tap(find.byKey(const Key('onboarding-next')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('onboarding-how-it-works')), findsOneWidget);

      // Go back
      await tester.tap(find.byKey(const Key('onboarding-back')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('onboarding-welcome')), findsOneWidget);
    });

    testWidgets('Onboarding_TelemetryOptIn_SetsProvider', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      // Navigate to end and complete
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const Key('onboarding-next')));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.byKey(const Key('onboarding-login')));
      await tester.pumpAndSettle();

      // Verify telemetry was opted in
      final container = ProviderScope.containerOf(
        tester.element(find.byType(OnboardingFlow)),
      );
      expect(container.read(telemetryConsentProvider), isTrue);
    });
  });

  group('Golden tests - onboarding', () {
    testWidgets('onboarding_welcome_light', (tester) async {
      await tester.pumpWidget(buildOnboarding());

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/onboarding_welcome_light.png'));
    });

    testWidgets('onboarding_how_it_works_light', (tester) async {
      await tester.pumpWidget(buildOnboarding());
      await tester.tap(find.byKey(const Key('onboarding-next')));
      await tester.pumpAndSettle();

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/onboarding_how_it_works_light.png'));
    });

    testWidgets('onboarding_security_light', (tester) async {
      await tester.pumpWidget(buildOnboarding());
      for (var i = 0; i < 2; i++) {
        await tester.tap(find.byKey(const Key('onboarding-next')));
        await tester.pumpAndSettle();
      }

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/onboarding_security_light.png'));
    });

    testWidgets('onboarding_get_started_light', (tester) async {
      await tester.pumpWidget(buildOnboarding());
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(const Key('onboarding-next')));
        await tester.pumpAndSettle();
      }

      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/onboarding_get_started_light.png'));
    });
  });
}
