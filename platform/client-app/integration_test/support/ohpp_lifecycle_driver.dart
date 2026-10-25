import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'ohpp_attester.dart' show pumpUntil, pumpUntilKey;

/// Flutter app LIFECYCLE driver (P3: one driver per role), the counterpart to
/// [OhppAttester] (which answers a participation request). Where OhppAttester
/// drives the pending/detail surface, this drives the account + device + app
/// lifecycle: onboarding, login, enrollment, app connect/revoke, rules,
/// security, offline/online, re-auth.
///
/// Every primitive is keyed (no find.byType/text as logic) and deterministic
/// (pumpUntil, no fixed sleeps). Tests express intent; this does the taps.
///
/// Keys it relies on (all verified present in lib/ 2026-10-25):
///   onboarding: onboarding-pageview/-next/-back/-get-started/-login,
///               onboarding-telemetry-toggle
///   login:      login-username/-password/-submit/-loading/-error
///   shell nav:  tab-pending/-apps/-history/-profile, app-drawer, drawer-*
///   apps:       apps-fab, connect-option-paste/-qr, paste-challenge-dialog/
///               -field/-submit, app-card-$i, app-detail-sheet,
///               app-revoke-button, revoke-confirm-dialog/-yes
///   rules:      rules-fab, rule-name-field/-auth-level/-add-condition,
///               condition-field-dropdown/-operator-dropdown/-value-field/-save,
///               rule-save-button, rule-toggle-$i, rule-delete-$i/-confirm
///   security:   drawer-security, security-rotate-key, rotate-key-dialog,
///               ohpp.security.dialog-confirm/-cancel
///
/// Navigation contract (core/navigation/app_router.dart): GoRouter redirects on
/// authProvider: unauthenticated -> /login; authenticated-on-login -> /pending.
/// Onboarding onComplete -> /login. Device enrollment happens post-login via
/// DeviceRegistrationService (no dedicated screen); the app lands on the Pending
/// tab once authenticated + registered.
class OhppLifecycleDriver {
  OhppLifecycleDriver(this.tester);

  final WidgetTester tester;

  // --- Onboarding -------------------------------------------------------------

  /// Page through the 4 onboarding screens and hand off to the login screen.
  /// Taps onboarding-next until the final page, then onboarding-login.
  /// Deterministic: waits for each keyed control before tapping.
  Future<void> completeOnboarding() async {
    await pumpUntilKey(tester, 'onboarding-pageview');
    // Three nexts: welcome -> how-it-works -> security -> get-started.
    for (var i = 0; i < 3; i++) {
      final next = find.byKey(const Key('onboarding-next'));
      if (next.evaluate().isEmpty) break;
      await tester.ensureVisible(next);
      await tester.tap(next);
      await tester.pumpAndSettle();
    }
    // The get-started page shows onboarding-login; tap it to reach /login.
    await pumpUntilKey(tester, 'onboarding-login');
    await tester.tap(find.byKey(const Key('onboarding-login')));
    await tester.pumpAndSettle();
  }

  /// Set the telemetry consent toggle on the final onboarding page before
  /// handing off. [enabled] is the desired state; a no-op if already there.
  Future<void> setOnboardingTelemetry({required bool enabled}) async {
    final toggle = find.byKey(const Key('onboarding-telemetry-toggle'));
    await pumpUntil(tester, toggle, reason: 'telemetry toggle on get-started');
    final sw = tester.widget<Switch>(find.descendant(of: toggle, matching: find.byType(Switch)));
    if (sw.value != enabled) {
      await tester.tap(toggle);
      await tester.pumpAndSettle();
    }
  }

  // --- Login / re-auth --------------------------------------------------------

  /// Drive the real UI login against Keycloak, then wait for the authenticated
  /// shell (Pending tab) to render. Unfocuses before tapping submit so the soft
  /// keyboard action does not double-submit.
  Future<void> uiLogin(String username, String password) async {
    await pumpUntilKey(tester, 'login-username');
    await tester.enterText(find.byKey(const Key('login-username')), username);
    await tester.enterText(find.byKey(const Key('login-password')), password);
    await tester.pumpAndSettle();
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    final submit = find.byKey(const Key('login-submit'));
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    // Enrollment (DeviceRegistrationService) runs post-login; the app lands on
    // the Pending tab once authenticated + registered.
    await pumpUntilKey(tester, 'tab-pending',
        timeout: const Duration(seconds: 40));
  }

  /// Assert a login attempt FAILED: the keyed error renders and we stay on the
  /// login screen (for the unhappy-path re-auth test).
  Future<void> expectLoginError() async {
    await pumpUntilKey(tester, 'login-error');
    expect(find.byKey(const Key('login-submit')), findsOneWidget,
        reason: 'a failed login should remain on the login screen');
  }

  // --- Navigation -------------------------------------------------------------

  Future<void> gotoTab(String tab) async {
    final key = 'tab-$tab';
    await pumpUntilKey(tester, key);
    await tester.tap(find.byKey(Key(key)));
    await tester.pumpAndSettle();
  }

  Future<void> openDrawerItem(String item) async {
    final drawer = find.byKey(const Key('app-drawer'));
    if (drawer.evaluate().isNotEmpty) {
      await tester.tap(drawer);
      await tester.pumpAndSettle();
    }
    final key = 'drawer-$item';
    await pumpUntilKey(tester, key);
    await tester.tap(find.byKey(Key(key)));
    await tester.pumpAndSettle();
  }

  // --- App connect / revoke ---------------------------------------------------

  /// Connect an app by pasting an OHPP challenge URI. Opens the apps tab FAB,
  /// chooses paste, fills the challenge, submits.
  Future<void> connectAppByPaste(String challengeUri) async {
    await gotoTab('apps');
    await pumpUntilKey(tester, 'apps-fab');
    await tester.tap(find.byKey(const Key('apps-fab')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'connect-option-paste');
    await tester.tap(find.byKey(const Key('connect-option-paste')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'paste-challenge-field');
    await tester.enterText(
        find.byKey(const Key('paste-challenge-field')), challengeUri);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('paste-challenge-submit')));
    await tester.pumpAndSettle();
  }

  /// Revoke the first connected app via its detail sheet + confirm dialog.
  /// (App cards are keyed app-card-$index; this opens index 0's detail.)
  Future<void> revokeFirstApp() async {
    await gotoTab('apps');
    await pumpUntilKey(tester, 'app-card-0');
    await tester.tap(find.byKey(const Key('app-card-0')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'app-revoke-button');
    await tester.tap(find.byKey(const Key('app-revoke-button')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'revoke-confirm-yes');
    await tester.tap(find.byKey(const Key('revoke-confirm-yes')));
    await tester.pumpAndSettle();
  }

  // --- Rules ------------------------------------------------------------------

  /// Create a rule: open rules FAB, name it, set auth level, save. Conditions
  /// are optional (a no-condition rule applies to all requests).
  Future<void> createRule({required String name, String? authLevel}) async {
    await openDrawerItem('rules');
    await pumpUntilKey(tester, 'rules-fab');
    await tester.tap(find.byKey(const Key('rules-fab')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'rule-name-field');
    await tester.enterText(find.byKey(const Key('rule-name-field')), name);
    await tester.pumpAndSettle();
    final save = find.byKey(const Key('rule-save-button'));
    await tester.ensureVisible(save);
    await tester.tap(save);
    await tester.pumpAndSettle();
  }

  /// Delete the rule at [index] via its keyed delete + confirm.
  Future<void> deleteRule(int index) async {
    await openDrawerItem('rules');
    final del = find.byKey(Key('rule-delete-$index'));
    await pumpUntil(tester, del, reason: 'rule-delete-$index');
    await tester.tap(del);
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'rule-delete-confirm');
    await tester.tap(find.byKey(const Key('rule-delete-confirm')));
    await tester.pumpAndSettle();
  }

  // --- Security ---------------------------------------------------------------

  /// Rotate the device key via the security screen + confirm dialog.
  Future<void> rotateKey() async {
    await openDrawerItem('security');
    await pumpUntilKey(tester, 'security-rotate-key');
    await tester.tap(find.byKey(const Key('security-rotate-key')));
    await tester.pumpAndSettle();
    await pumpUntilKey(tester, 'ohpp.security.dialog-confirm');
    await tester.tap(find.byKey(const Key('ohpp.security.dialog-confirm')));
    await tester.pumpAndSettle();
  }

  // --- Refresh (shared production path) ---------------------------------------

  /// Force the pending list to refetch by emitting the production resumed
  /// lifecycle transition (AppLifecycleManager._onAppResumed -> refresh()).
  /// The headless harness never emits resumed on its own, so a multi-step flow
  /// must call this to pick up newly-arrived requests. (Same mechanism the
  /// pizza whole-case uses between steps.)
  Future<void> refreshPending() async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle(const Duration(milliseconds: 700));
  }
}
