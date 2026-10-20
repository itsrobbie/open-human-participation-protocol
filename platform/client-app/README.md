# OHPP Client App (Flutter)

Production mobile client for the Open Human Participation Protocol. Implements the Attester role, allowing users to receive, review, and respond to participation requests on iOS and Android.

## Prerequisites

- Flutter 3.47.0+
- Xcode 15+ (iOS)
- Android SDK API 36 (Android)
- Java 17 (Android)

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

## Quick Start

```bash
# Get dependencies
flutter pub get

# Run tests (385 tests)
flutter test

# Lint
flutter analyze

# Build
flutter build apk --debug
flutter build ios --debug --no-codesign
```

## Project Structure

```
lib/
  core/
    theme/          - AppTheme, AppColors, AppSpacing
    database/       - AppDatabase (sqflite + SQLCipher), schema, CacheManager
    api/            - ResolverApiClient, interceptors, SseClient
    auth/           - TokenManager, BiometricService
    crypto/         - CryptoService (platform channel)
    notifications/  - FcmService
    navigation/     - DeepLinkHandler
    sync/           - SyncCoordinator
  shared/
    models/         - Domain entities, enums
    providers/      - Riverpod providers (auth, pending, history, rules, apps)
    widgets/        - Reusable components (badges, states, skeletons)
  features/
    shell/          - MainShell (tab bar + drawer)
    login/          - LoginScreen
    onboarding/     - OnboardingFlow (4 pages)
    pending/        - PendingScreen, RequestDetailSheet, AttestationBuilder, OfflineQueueManager
    history/        - HistoryScreen, HistoryDetailScreen
    apps/           - AppsScreen, QrScannerScreen, ChallengeParser
    profile/        - ProfileScreen
    settings/       - SettingsScreen, AppearanceScreen, SecurityScreen, NotificationPrefsScreen
    rules/          - RulesScreen, RuleEditorScreen, RuleEngine
```

## Test Pyramid

| Tier | Count | Command |
|------|-------|---------|
| Unit (domain services) | ~150 | `flutter test test/` |
| Widget (screens) | ~70 | included above |
| Golden (visual regression) | ~65 | included above |
| Integration (full flows) | 30 | included above |
| E2E (device + Docker) | 7 | `flutter test test_e2e/` |
| **Total** | **385** | `flutter test` |

```bash
# Update golden baselines after intentional visual changes
flutter test --update-goldens

# Run E2E tests (requires Docker stack + connected device)
docker compose -f docker-compose.e2e-flutter.yml up -d --wait
flutter test test_e2e/ --dart-define=E2E_RESOLVER_URL=http://localhost:5100
docker compose -f docker-compose.e2e-flutter.yml down -v
```

## Makefile Targets

From the repo root:

```bash
make flutter-test           # Full test pyramid (minus E2E)
make flutter-test-unit      # Unit + widget only
make flutter-test-golden    # Golden tests
make flutter-golden-update  # Regenerate golden baselines
make flutter-test-e2e       # E2E against Docker (FINAL GATE)
make flutter-lint           # Analyzer
make flutter-build-ios      # iOS debug build
make flutter-build-android  # Android APK debug
```

## Architecture

- **State**: Riverpod (StateNotifier + Provider)
- **Routing**: GoRouter with deep link support (`ohpp://` scheme)
- **HTTP**: Dio with auth/retry/pinning interceptors
- **Database**: sqflite + SQLCipher (encrypted local cache)
- **Crypto**: Platform channels to Secure Enclave (iOS) / StrongBox (Android)
- **Push**: Firebase Cloud Messaging
- **QR**: mobile_scanner

## Key Design Decisions

1. **sqflite over Drift** - Dart 3.13/Flutter 3.47 has analyzer incompatibility with build_runner. Manual SQL with SQLCipher.
2. **No code generation** - Same analyzer issue. Manual model classes and providers.
3. **Rules sync to server** - Rules belong to the user, not the device.
4. **CocoaPods over SPM** - Several plugins don't support Swift Package Manager yet.
5. **Portal pattern for auth** - Uses NotFound (not Forbid) for cross-user access attempts.
