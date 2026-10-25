import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:ohpp_client/features/apps/apps_screen.dart';
import 'package:ohpp_client/features/apps/challenge_parser.dart';
import 'package:ohpp_client/features/apps/qr_scanner_screen.dart';
import 'package:ohpp_client/features/history/history_detail_screen.dart';
import 'package:ohpp_client/features/history/history_screen.dart';
import 'package:ohpp_client/features/login/login_screen.dart';
import 'package:ohpp_client/features/login/register_screen.dart';
import 'package:ohpp_client/features/onboarding/onboarding_flow.dart';
import 'package:ohpp_client/features/pending/pending_screen.dart';
import 'package:ohpp_client/features/profile/profile_screen.dart';
import 'package:ohpp_client/features/rules/rule_editor_screen.dart';
import 'package:ohpp_client/features/rules/rules_screen.dart';
import 'package:ohpp_client/features/settings/appearance_screen.dart';
import 'package:ohpp_client/features/settings/developer_screen.dart';
import 'package:ohpp_client/features/settings/notification_prefs_screen.dart';
import 'package:ohpp_client/features/settings/security_screen.dart';
import 'package:ohpp_client/features/settings/settings_screen.dart';
import 'package:ohpp_client/features/shell/main_shell.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

/// Route path constants.
abstract class AppRoutes {
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const pending = '/pending';
  static const history = '/history';
  static const historyDetail = '/history/:id';
  static const apps = '/apps';
  static const qrScanner = '/apps/scan';
  static const profile = '/profile';
  static const settings = '/settings';
  static const appearance = '/settings/appearance';
  static const security = '/settings/security';
  static const notifications = '/settings/notifications';
  static const rules = '/settings/rules';
  static const ruleEditor = '/settings/rules/edit';
  static const ruleCreate = '/settings/rules/new';
  static const developer = '/settings/developer';
}

/// Navigation shell key for maintaining shell state across tab switches.
final _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');
final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// Listenable that notifies GoRouter when auth state changes.
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(Ref ref) {
    ref.listen<AuthData>(authProvider, (_, __) => notifyListeners());
  }
}

/// GoRouter provider, refreshes redirect on auth state changes.
final routerProvider = Provider<GoRouter>((ref) {
  final authChangeNotifier = _AuthChangeNotifier(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.pending,
    debugLogDiagnostics: false,
    refreshListenable: authChangeNotifier,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final isAuthenticated = auth.state == AuthState.authenticated;
      final isOnLogin = state.matchedLocation == AppRoutes.login;
      final isOnOnboarding = state.matchedLocation == AppRoutes.onboarding;
      final isOnRegister = state.matchedLocation == AppRoutes.register;

      // Not authenticated: redirect to login (unless already on an
      // unauthenticated route: login, register, or onboarding).
      if (!isAuthenticated && !isOnLogin && !isOnOnboarding && !isOnRegister) {
        return AppRoutes.login;
      }

      // Authenticated but on login/register page: redirect to home
      if (isAuthenticated && (isOnLogin || isOnRegister)) {
        return AppRoutes.pending;
      }

      return null; // No redirect needed
    },
    routes: [
      // --- Unauthenticated routes ---
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => OnboardingFlow(
          onComplete: () => context.go(AppRoutes.login),
        ),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterScreen(),
      ),

      // --- Authenticated routes (shell with bottom nav) ---
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          final index = _indexFromLocation(state.matchedLocation);
          return MainShell(currentIndex: index, child: child);
        },
        routes: [
          GoRoute(
            path: AppRoutes.pending,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PendingScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.history,
            pageBuilder: (context, state) => NoTransitionPage(
              child: HistoryScreen(
                onEntryTap: (entry) {
                  final id = entry['requestId'] as String? ??
                      entry['id'] as String? ??
                      'unknown';
                  context.push(
                    AppRoutes.historyDetail.replaceFirst(':id', id),
                    extra: entry,
                  );
                },
              ),
            ),
          ),
          GoRoute(
            path: AppRoutes.apps,
            pageBuilder: (context, state) => NoTransitionPage(
              child: AppsScreen(
                onQrScan: (_) async {
                  // The scanner pops the scanned value; process it to actually
                  // connect the app (push alone does not register).
                  final scanned = await context.push<String>(AppRoutes.qrScanner);
                  if (scanned == null || scanned.isEmpty || !context.mounted) return;
                  final result = ChallengeParser().parse(scanned);
                  if (!result.isSuccess) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Invalid QR code. Not a valid registration link.'),
                      behavior: SnackBarBehavior.floating,
                    ));
                    return;
                  }
                  final ok = await ref
                      .read(appsProvider.notifier)
                      .connectViaChallenge(result.challenge!.base64Payload);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok
                        ? 'Connected ${result.challenge!.appId}'
                        : 'Could not connect. The link may be invalid or expired.'),
                    behavior: SnackBarBehavior.floating,
                  ));
                },
                onPaste: (_) => _showPasteDialog(context, ref),
              ),
            ),
          ),
          GoRoute(
            path: AppRoutes.profile,
            pageBuilder: (context, state) => NoTransitionPage(
              child: ProfileScreen(
                user: const {
                  'username': '',
                  'email': '',
                  'resolverUrl': '',
                },
                devices: const [],
                onOpenSettings: () => context.push(AppRoutes.settings),
              ),
            ),
          ),
        ],
      ),

      // --- Full-screen routes (outside shell) ---
      GoRoute(
        path: AppRoutes.historyDetail,
        builder: (context, state) {
          final entry = state.extra as Map<String, dynamic>? ?? {};
          return HistoryDetailScreen(entry: entry);
        },
      ),
      GoRoute(
        path: AppRoutes.qrScanner,
        builder: (context, state) => QrScannerScreen(
          onResult: (value) {
            // Process registration challenge via ChallengeParser
            context.pop(value);
          },
          onCancel: () => context.pop(),
        ),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => SettingsScreen(
          onNavigate: (route) {
            switch (route) {
              case 'appearance':
                context.push(AppRoutes.appearance);
              case 'security':
                context.push(AppRoutes.security);
              case 'notifications':
                context.push(AppRoutes.notifications);
              case 'rules':
                context.push(AppRoutes.rules);
              case 'developer':
                context.push(AppRoutes.developer);
            }
          },
        ),
      ),
      GoRoute(
        path: AppRoutes.developer,
        builder: (context, state) => const DeveloperScreen(),
      ),
      GoRoute(
        path: AppRoutes.appearance,
        builder: (context, state) => const AppearanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.security,
        builder: (context, state) => const SecurityScreen(
          keyAlgorithm: 'ES256',
          storageLevel: 'Secure Enclave',
        ),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationPrefsScreen(prefs: []),
      ),
      GoRoute(
        path: AppRoutes.rules,
        builder: (context, state) => RulesScreen(
          onCreateTap: () => context.push(AppRoutes.ruleCreate),
          onEditTap: (rule) => context.push(AppRoutes.ruleEditor, extra: rule),
        ),
      ),
      GoRoute(
        path: AppRoutes.ruleCreate,
        builder: (context, state) => Consumer(
          builder: (context, ref, _) => RuleEditorScreen(
            onSave: (rule) {
              ref.read(rulesProvider.notifier).create(rule);
              context.pop();
            },
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.ruleEditor,
        builder: (context, state) {
          final rule = state.extra as Map<String, dynamic>?;
          return Consumer(
            builder: (context, ref, _) => RuleEditorScreen(
              existingRule: rule,
              onSave: (updated) {
                ref.read(rulesProvider.notifier).create(updated);
                context.pop();
              },
            ),
          );
        },
      ),
    ],
  );
});

/// Map a matched location to the bottom nav tab index.
int _indexFromLocation(String location) {
  if (location.startsWith(AppRoutes.pending)) return 0;
  if (location.startsWith(AppRoutes.history)) return 1;
  if (location.startsWith(AppRoutes.apps)) return 2;
  if (location.startsWith(AppRoutes.profile)) return 3;
  return 0;
}


/// Show a dialog for pasting a registration link.
void _showPasteDialog(BuildContext context, Ref ref) {
  final controller = TextEditingController();
  final parser = ChallengeParser();

  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      key: const Key('paste-challenge-dialog'),
      title: const Text('Paste Registration Link'),
      content: TextField(
        key: const Key('paste-challenge-field'),
        controller: controller,
        decoration: const InputDecoration(
          hintText: 'ohpp://register?challenge=...',
          labelText: 'Registration link',
        ),
        maxLines: 3,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
        TextButton(
          key: const Key('paste-challenge-submit'),
          onPressed: () {
            final input = controller.text.trim();
            if (input.isEmpty) return;

            final result = parser.parse(input);
            Navigator.pop(ctx);

            if (result.isSuccess) {
              // Actually connect the app: process the challenge against the
              // Resolver, then refresh. (Parsing alone does not register.)
              ref
                  .read(appsProvider.notifier)
                  .connectViaChallenge(result.challenge!.base64Payload)
                  .then((ok) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok
                        ? 'Connected ${result.challenge!.appId}'
                        : 'Could not connect. The link may be invalid or expired.'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              });
            } else {
              String errorMsg;
              switch (result.error!) {
                case ChallengeError.format:
                  errorMsg = 'Invalid format. Check the link and try again.';
                case ChallengeError.invalid:
                  errorMsg = 'Invalid challenge. Missing required fields.';
                case ChallengeError.expired:
                  errorMsg = 'This registration link has expired.';
              }
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(errorMsg),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          child: const Text('Register'),
        ),
      ],
    ),
  );
}
