import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app.dart';
import 'core/api/auth_interceptor.dart';
import 'core/api/cert_pinner.dart';
import 'core/api/cert_pinning_adapter.dart';
import 'core/api/dio_adapter.dart';
import 'core/api/logging_interceptor.dart';
import 'core/api/resolver_api_client.dart';
import 'core/api/resolver_data_sources.dart';
import 'core/api/sse_client.dart';
import 'core/api/typed_api_client.dart';
import 'core/auth/auto_approve_biometric_provider.dart';
import 'core/auth/biometric_service.dart';
import 'core/auth/real_local_auth_provider.dart';
import 'core/crypto/agent_crypto_service.dart';
import 'core/crypto/real_crypto_service.dart';
import 'core/device/device_registration_service.dart';
import 'core/lifecycle/app_lifecycle_manager.dart';
import 'core/observability/analytics_sink.dart';
import 'core/observability/crash_reporter.dart';
import 'core/observability/dev_logger.dart';
import 'core/observability/sentry_crash_reporter.dart';
import 'core/observability/umami_analytics_sink.dart';
import 'core/telemetry/otlp_telemetry_service.dart';
import 'core/telemetry/telemetry_service.dart';
import 'features/login/login_screen.dart';
import 'features/pending/attestation_builder.dart';
import 'features/rules/rule_engine.dart';
import 'shared/providers/analytics_sink_provider.dart';
import 'shared/providers/apps_provider.dart';
import 'shared/providers/attestation_service_provider.dart';
import 'shared/providers/auth_provider.dart';
import 'shared/providers/crash_reporter_provider.dart';
import 'shared/providers/developer_settings_provider.dart';
import 'shared/providers/history_provider.dart';
import 'shared/providers/pending_provider.dart';
import 'shared/providers/user_profile_provider.dart';
import 'shared/providers/rules_provider.dart';
import 'shared/providers/telemetry_service_provider.dart';

/// Resolver API base URL (configurable per environment).
const _resolverBaseUrl = String.fromEnvironment(
  'RESOLVER_URL',
  defaultValue: 'http://localhost:5050',
);

// --- Observability config (U7.1) - all empty by default => the app runs with
// no-op seams unless explicitly configured at build time via --dart-define. ---

/// OpenTelemetry Collector base endpoint for app traces (OTLP/HTTP), e.g.
/// http://<host-lan-ip>:4318. Empty => telemetry export disabled.
const _otelEndpoint = String.fromEnvironment('OTEL_ENDPOINT', defaultValue: '');

/// GlitchTip DSN (Sentry-compatible) for crash reporting. Empty => disabled.
const _crashDsn = String.fromEnvironment('CRASH_DSN', defaultValue: '');

/// Umami host + website UUID (the analytics key) for product analytics.
/// Empty => disabled.
const _analyticsHost = String.fromEnvironment('ANALYTICS_HOST', defaultValue: '');
const _analyticsKey = String.fromEnvironment('ANALYTICS_KEY', defaultValue: '');

/// Resolver certificate pin(s) - `sha256/<base64>`, comma-separated primary+backup.
/// Empty => pinning disabled (fail-open for non-TLS/dev). Set for pinned builds.
const _resolverCertPin = String.fromEnvironment('RESOLVER_CERT_PIN', defaultValue: '');

/// Dev-only step-ca root CA (PEM) to trust in dev builds, via --dart-define.
const _devRootCaPem = String.fromEnvironment('DEV_ROOT_CA_PEM', defaultValue: '');

/// Anti-agent primitive selection. The app's purpose is that a HUMAN proves
/// participation: on real builds the signing key is Secure-Enclave-bound and
/// biometric-gated so no on-device agent can answer. That hardware cannot be
/// driven by an automated agent on a simulator, so `test` substitutes an
/// agent-friendly software signer + auto-approve biometric behind the same
/// abstractions. Defaults to `real`; the sim/e2e make targets pass `test`.
/// Release/device builds must NEVER pass `test`.
const _antiAgentMode =
    String.fromEnvironment('OHPP_ANTI_AGENT_MODE', defaultValue: 'real');
const _isAgentTestMode = _antiAgentMode == 'test';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // --- Observability seams (U7.1) ---
  // Resolve each seam from its --dart-define; unset => no-op. Kept in main.dart
  // so the seam classes stay env-free and unit-testable.
  final crashReporter = await _initCrashReporter();
  final telemetry = _buildTelemetryService();
  final analytics = await _initAnalyticsSink();

  // Route Flutter framework + platform errors into the crash reporter. Fail-open.
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    crashReporter.recordError(
      details.exception,
      details.stack,
      context: {'source': 'FlutterError.onError'},
      fatal: false,
    );
  };
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    crashReporter.recordError(error, stack, context: {'source': 'PlatformDispatcher.onError'});
    return true; // handled
  };

  // Secure storage for auth tokens
  const storage = FlutterSecureStorage();

  // Auth interceptor with token refresh via Keycloak
  final authInterceptor = AuthInterceptor(
    storage: storage,
    refreshUrl: '$_resolverBaseUrl/api/auth/refresh',
    onSessionExpired: () {
      // Will be handled by the auth provider listener in the widget tree
    },
  );

  // Dio instance with auth and retry interceptors
  final dio = Dio(BaseOptions(
    baseUrl: _resolverBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));
  dio.interceptors.add(authInterceptor);
  dio.interceptors.add(RetryInterceptor(dio: dio));
  // Diagnostic logging (after auth so it can report the attached token type).
  // No-ops unless developer logging is enabled in Settings > Developer.
  dio.interceptors.add(LoggingInterceptor());

  // Certificate pinning (U7.1, Phase 6). Enforced when RESOLVER_CERT_PIN is set
  // (fail-closed); dev builds may also trust the local step-ca root via
  // DEV_ROOT_CA_PEM. No-op when neither is provided.
  applyCertPinning(
    dio,
    CertPinner.fromDefine(_resolverCertPin),
    devRootCaPem: _devRootCaPem.isEmpty ? null : _devRootCaPem,
  );

  // Typed API client (instrumented with telemetry; no-op unless OTEL_ENDPOINT set)
  final typedApi = TypedApiClient(dio: DioAdapter(dio), telemetry: telemetry);

  // Real data sources backed by the API client
  final pendingSource = ResolverPendingDataSource(api: typedApi);
  final rulesSource = ResolverRulesDataSource(api: typedApi);
  final appsSource = ResolverAppsDataSource(api: typedApi);
  final historySource = ResolverHistoryDataSource(api: typedApi);

  // Device registration service
  final deviceService = DeviceRegistrationService(
    storage: storage,
    resolverBaseUrl: _resolverBaseUrl,
  );

  // Anti-agent primitives, selected ONCE at the composition root by build flag.
  // real  -> Secure Enclave signing + real biometric prompt (release/device).
  // test  -> software ES256 signer + auto-approve biometric (sim/automation).
  final CryptoServiceInterface cryptoService =
      _isAgentTestMode ? AgentCryptoService(storage: storage) : RealCryptoService();
  final BiometricProvider biometricProvider = _isAgentTestMode
      ? const AutoApproveBiometricProvider()
      : RealLocalAuthProvider();
  DevLog.instance.info('auth',
      'Anti-agent mode: $_antiAgentMode (${_isAgentTestMode ? 'software signer + auto-approve' : 'Secure Enclave + real biometric'})');

  runApp(
    ProviderScope(
      overrides: [
        loginProvider.overrideWith((ref) {
          // Auth goes through the RESOLVER's /api/auth, never the identity
          // provider directly: the provider stays hidden and swappable, and the
          // app names no IdP. Shared post-auth step (store tokens -> enroll
          // device -> publish key -> set auth state) is reused by register too.
          Future<bool> afterAuth(Map<String, dynamic> data, String username) async {
            final accessToken = data['accessToken'] as String;
            final refreshToken = data['refreshToken'] as String?;
            final expiresIn = (data['expiresInSeconds'] as num?)?.toInt() ?? 300;
            final expiresAt =
                DateTime.now().toUtc().add(Duration(seconds: expiresIn));

            await storage.write(key: 'access_token', value: accessToken);
            if (refreshToken != null) {
              await storage.write(key: 'refresh_token', value: refreshToken);
            }
            await storage.write(
                key: 'token_expires_at', value: expiresAt.toIso8601String());

            DevLog.instance.info('device', 'ensureRegistered() starting');
            final deviceId =
                await deviceService.ensureRegistered(identityToken: accessToken);
            if (deviceId == null) {
              DevLog.instance.error('device',
                  'Device registration FAILED (no deviceId/deviceToken stored). '
                  'Device-scoped calls will 401.');
            } else {
              DevLog.instance.info('device', 'Device registered: $deviceId');
              try {
                final pub = await cryptoService.ensurePublicKey();
                final keyOk = await deviceService.registerPublicKey(
                  publicKeyPem: pub.publicKeyPem,
                  algorithm: pub.algorithm,
                );
                DevLog.instance.info('device',
                    'Public key registration ${keyOk ? 'OK' : 'FAILED'} (${pub.algorithm})');
              } catch (e) {
                DevLog.instance.error('device',
                    'Public key registration threw', detail: e.toString());
              }
            }

            ref.read(authProvider.notifier).login(
                  userId: username,
                  accessToken: accessToken,
                );
            return true;
          }

          return LoginNotifier(
            onLogin: (username, password) async {
              final authDio = Dio();
              try {
                final response = await authDio.post<Map<String, dynamic>>(
                  '$_resolverBaseUrl/api/auth/login',
                  options: Options(contentType: 'application/json'),
                  data: {'username': username, 'password': password},
                );
                if (response.statusCode == 200 && response.data != null) {
                  DevLog.instance.info('auth', 'Login OK for "$username"');
                  return await afterAuth(response.data!, username);
                }
                DevLog.instance
                    .warning('auth', 'Login returned ${response.statusCode}');
                return false;
              } on DioException catch (e) {
                DevLog.instance.error('auth', 'Login threw ${e.type.name}',
                    detail: 'status=${e.response?.statusCode} message=${e.message}');
                return false;
              }
            },
            onRegister: (username, email, password) async {
              final authDio = Dio();
              try {
                final response = await authDio.post<Map<String, dynamic>>(
                  '$_resolverBaseUrl/api/auth/register',
                  options: Options(contentType: 'application/json'),
                  data: {
                    'username': username,
                    'email': email,
                    'password': password,
                  },
                );
                if ((response.statusCode == 200 || response.statusCode == 201) &&
                    response.data != null) {
                  DevLog.instance.info('auth', 'Register OK for "$username"');
                  return await afterAuth(response.data!, username);
                }
                DevLog.instance
                    .warning('auth', 'Register returned ${response.statusCode}');
                return false;
              } on DioException catch (e) {
                DevLog.instance.error('auth', 'Register threw ${e.type.name}',
                    detail: 'status=${e.response?.statusCode} message=${e.message}');
                return false;
              }
            },
          );
        }),
        pendingProvider.overrideWith((ref) {
          return PendingNotifier(dataSource: pendingSource, analytics: analytics);
        }),
        historyProvider.overrideWith((ref) {
          return HistoryNotifier(dataSource: historySource);
        }),
        rulesProvider.overrideWith((ref) {
          return RulesNotifier(dataSource: rulesSource);
        }),
        appsProvider.overrideWith((ref) {
          return AppsNotifier(dataSource: appsSource);
        }),
        profileDataLoaderProvider.overrideWith((ref) => () async {
              final auth = ref.read(authProvider);
              final currentId = await deviceService.getDeviceId();
              List<Map<String, dynamic>> devices = const [];
              try {
                final raw = await typedApi.getDevices();
                devices = raw
                    .map((d) => {...d, 'isCurrent': d['id'] == currentId})
                    .toList();
              } catch (_) {
                // Fail-open: an empty device list beats a crashed Profile.
              }
              return ProfileData(
                user: {'userId': auth.userId ?? ''},
                devices: devices,
              );
            }),
        attestationServiceProvider.overrideWithValue(
          AttestationService(
            ruleEngine: RuleEngine(),
            biometricService: BiometricService(provider: biometricProvider),
            attestationBuilder: AttestationBuilder(cryptoService: cryptoService),
            api: typedApi,
            getDeviceId: () async =>
                await deviceService.getDeviceId() ?? 'unregistered',
            getRules: () => [],
            analytics: analytics,
          ),
        ),
        sseClientProvider.overrideWith((ref) {
          return SseClient(
            baseUrl: _resolverBaseUrl,
            // The events endpoint requires the DEVICE token (same as other
            // /api/devices/me/* routes), read from secure storage.
            getAuthToken: () => storage.read(key: 'ohpp_device_token'),
            onEvent: (event) {
              switch (event.type) {
                case 'new_request':
                  // Payload is the full DeviceParticipationRequest JSON.
                  ref.read(pendingProvider.notifier).addFromSse(event.data);
                case 'request_expired':
                case 'request_cancelled':
                  final id = event.data['requestId'] as String? ?? '';
                  ref.read(pendingProvider.notifier).removeById(id);
              }
            },
            connectionProvider: HttpSseConnectionProvider(),
            onConnectionStateChanged: (connected) {
              // Drive the poll-fallback: poll only while SSE is NOT live.
              ref.read(sseConnectedProvider.notifier).state = connected;
            },
            onAuthExpired: () {
              // Handled by auth interceptor
            },
          );
        }),
        // Observability seams (U7.1). Resolved above from --dart-define; default
        // to no-op when unconfigured.
        telemetryServiceProvider.overrideWithValue(telemetry),
        crashReporterProvider.overrideWithValue(crashReporter),
        analyticsSinkProvider.overrideWithValue(analytics),
        // Developer settings persisted in secure storage; loads the saved
        // logging flag and syncs DevLog on startup.
        developerSettingsProvider.overrideWith(
          (ref) => DeveloperSettingsNotifier(storage: storage),
        ),
      ],
      child: const OhppApp(),
    ),
  );

  // First taxonomy event: the app is open and running.
  await analytics.capture(AnalyticsEvent.appOpened);
}

/// Build the telemetry exporter. OTLP/HTTP when OTEL_ENDPOINT is set, else no-op.
TelemetryService _buildTelemetryService() {
  if (_otelEndpoint.trim().isEmpty) {
    return const NoopTelemetryService();
  }
  return OtlpTelemetryService(
    endpoint: _otelEndpoint,
    poster: (url, headers, body) async {
      final dio = Dio();
      final response = await dio.postUri<dynamic>(
        url,
        data: body,
        options: Options(
          headers: headers,
          // Never throw on non-2xx; the caller is fail-open.
          validateStatus: (_) => true,
        ),
      );
      return response.statusCode ?? 0;
    },
  );
}

/// Initialize crash reporting. Sentry (-> GlitchTip) when CRASH_DSN is set, else no-op.
Future<CrashReporter> _initCrashReporter() async {
  if (_crashDsn.trim().isEmpty) {
    return const NoopCrashReporter();
  }
  try {
    await SentryFlutter.init((options) {
      options.dsn = _crashDsn;
      options.tracesSampleRate = 0.0; // errors only; traces go via OTLP
      options.attachStacktrace = true;
      // Do not send user PII by default (NFR-S1).
      options.sendDefaultPii = false;
    });
    return const SentryCrashReporter();
  } catch (e) {
    debugPrint('[main] Sentry init failed ($e); crash reporting disabled');
    return const NoopCrashReporter();
  }
}

/// Initialize analytics. Umami when ANALYTICS_HOST + ANALYTICS_KEY (the Umami
/// website UUID) are set, else no-op. Construction alone does not touch the
/// network; capture() is fail-open.
Future<AnalyticsSink> _initAnalyticsSink() async {
  if (_analyticsHost.trim().isEmpty || _analyticsKey.trim().isEmpty) {
    return const NoopAnalyticsSink();
  }
  try {
    return UmamiAnalyticsSink(host: _analyticsHost, websiteId: _analyticsKey);
  } catch (e) {
    debugPrint('[main] Umami analytics init failed ($e); analytics disabled');
    return const NoopAnalyticsSink();
  }
}
