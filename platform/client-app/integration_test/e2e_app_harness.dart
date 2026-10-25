import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ohpp_client/app.dart';
import 'package:ohpp_client/core/api/dio_adapter.dart';
import 'package:ohpp_client/core/api/resolver_data_sources.dart';
import 'package:ohpp_client/core/api/typed_api_client.dart';
import 'package:ohpp_client/core/auth/auto_approve_biometric_provider.dart';
import 'package:ohpp_client/core/auth/biometric_service.dart';
import 'package:ohpp_client/core/crypto/agent_crypto_service.dart';
import 'package:ohpp_client/features/login/login_screen.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/shared/models/participation_rule.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';
import 'package:ohpp_client/shared/providers/attestation_service_provider.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

import 'e2e_helpers.dart';

/// Shared harness that builds the real [OhppApp] wired to the dev-stack backend,
/// with the production composition running in test-mode anti-agent (software
/// ES256 signer + auto-approve biometric — the same primitives
/// OHPP_ANTI_AGENT_MODE=test selects in main.dart).
///
/// Two entry points:
///  - [buildAppForLogin]: starts unauthenticated; drive the UI login. Used by
///    the dedicated auth test.
///  - [buildAppSignedIn]: injects a pre-acquired token so the app starts
///    authenticated, skipping the Keycloak round-trip and the login UI. Used by
///    every other feature test to cut overhead.
///
/// Both use the real data sources (pending/history/rules/apps) and a real
/// [AttestationService] so the approve path performs a genuine signed submit.
class E2EHarness {
  E2EHarness._({
    required this.pendingSource,
    required this.attestationService,
    required this.cryptoService,
    required this.deviceToken,
  });

  final ResolverPendingDataSource pendingSource;
  final AttestationService attestationService;
  final AgentCryptoService cryptoService;
  final String deviceToken;

  /// Build the harness. Pass [deviceToken] so device-scoped API calls
  /// (pending fetch, attestation submit) authenticate as that device.
  static E2EHarness create({required String deviceToken}) {
    final dio = Dio(BaseOptions(
      baseUrl: e2eResolverUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $deviceToken',
      },
    ));
    final typedApi = TypedApiClient(dio: DioAdapter(dio));
    final crypto = AgentCryptoService();

    final attestation = AttestationService(
      ruleEngine: RuleEngine(),
      // Test-mode anti-agent primitives, matching main.dart's OHPP_ANTI_AGENT_MODE=test.
      biometricService:
          BiometricService(provider: const AutoApproveBiometricProvider()),
      attestationBuilder: AttestationBuilder(cryptoService: crypto),
      api: typedApi,
      getDeviceId: () async => 'e2e-device',
      // A no-condition AuthLevel.none rule so the (auto-approving) biometric is
      // skipped entirely; the signing + submit are still real.
      getRules: () => [
        ParticipationRule(
          id: 'e2e-auto',
          name: 'E2E auto auth',
          priority: 0,
          authLevel: AuthLevel.none,
          createdAt: DateTime.now().toUtc(),
          updatedAt: DateTime.now().toUtc(),
        ),
      ],
    );

    return E2EHarness._(
      pendingSource: ResolverPendingDataSource(api: typedApi),
      attestationService: attestation,
      cryptoService: crypto,
      deviceToken: deviceToken,
    );
  }

  /// Publish the harness's software public key to the resolver
  /// (POST /api/devices/me/keys) so it can verify this device's attestation
  /// signatures. In production this happens in the login flow; feature tests
  /// that use [buildAppSignedIn] (which bypasses that flow) must call this once
  /// during setup, before approving a request.
  Future<void> registerDeviceKey() async {
    final pub = await cryptoService.ensurePublicKey();
    final client = HttpClient();
    try {
      final req =
          await client.postUrl(Uri.parse('$e2eResolverUrl/api/devices/me/keys'));
      req.headers.set('Authorization', 'Bearer $deviceToken');
      req.headers.contentType = ContentType.json;
      req.write(jsonEncode(
          {'publicKey': pub.publicKeyPem, 'algorithm': pub.algorithm}));
      final resp = await req.close();
      await resp.drain<void>();
      if (resp.statusCode != 200) {
        throw StateError('device key registration failed: HTTP ${resp.statusCode}');
      }
    } finally {
      client.close();
    }
  }

  List<Override> _overrides({required String deviceToken}) {
    final dio = Dio(BaseOptions(
      baseUrl: e2eResolverUrl,
      headers: {'Authorization': 'Bearer $deviceToken'},
    ));
    final api = TypedApiClient(dio: DioAdapter(dio));
    return [
      pendingProvider.overrideWith(
          (ref) => PendingNotifier(dataSource: pendingSource)),
      historyProvider.overrideWith(
          (ref) => HistoryNotifier(dataSource: ResolverHistoryDataSource(api: api))),
      rulesProvider.overrideWith(
          (ref) => RulesNotifier(dataSource: ResolverRulesDataSource(api: api))),
      appsProvider.overrideWith(
          (ref) => AppsNotifier(dataSource: ResolverAppsDataSource(api: api))),
      attestationServiceProvider.overrideWithValue(attestationService),
    ];
  }

  /// App that starts UNAUTHENTICATED. [onLogin] performs the Keycloak grant and
  /// calls authProvider.login on success (the dedicated auth test uses this to
  /// drive the real UI login).
  Widget buildAppForLogin({required String deviceToken}) {
    return ProviderScope(
      overrides: [
        loginProvider.overrideWith((ref) => LoginNotifier(
              onLogin: (username, password) async {
                final token = await getAccessTokenFor(username, password);
                if (token == null) return false;
                ref
                    .read(authProvider.notifier)
                    .login(userId: username, accessToken: token);
                return true;
              },
            )),
        ..._overrides(deviceToken: deviceToken),
      ],
      child: const OhppApp(),
    );
  }

  /// App that starts UNAUTHENTICATED and wires login + REGISTER to the REAL
  /// Resolver /api/auth endpoints (the production path, provider hidden). The
  /// account-creation whole-case uses this: it drives the in-app sign-up UI,
  /// which calls the resolver broker, then enrolls the device exactly as
  /// main.dart does. [deviceToken] seeds the device-scoped API client; the real
  /// enrollment re-derives the device from the brokered identity token.
  Widget buildAppForAuth({required String deviceToken}) {
    Future<bool> afterBrokeredAuth(Map<String, dynamic> data, String username, Ref ref) async {
      final accessToken = data['accessToken'] as String?;
      if (accessToken == null) return false;
      // Enroll the device with the brokered identity token (same as main.dart).
      final device = await setupDevice(accessToken);
      if (device != null) {
        // Publish THIS harness's signing key so attestations verify (the
        // harness instance method, not the free helper of the same name).
        await registerDeviceKey();
      }
      ref.read(authProvider.notifier).login(userId: username, accessToken: accessToken);
      return true;
    }

    Future<Map<String, dynamic>?> postAuth(String path, Object body) async {
      final client = HttpClient();
      try {
        final req = await client.postUrl(Uri.parse('$e2eResolverUrl$path'));
        req.headers.contentType = ContentType.json;
        req.write(jsonEncode(body));
        final resp = await req.close();
        final text = await resp.transform(utf8.decoder).join();
        if (resp.statusCode != 200 && resp.statusCode != 201) return null;
        return jsonDecode(text) as Map<String, dynamic>;
      } catch (_) {
        return null;
      } finally {
        client.close();
      }
    }

    return ProviderScope(
      overrides: [
        loginProvider.overrideWith((ref) => LoginNotifier(
              onLogin: (username, password) async {
                final data = await postAuth('/api/auth/login',
                    {'username': username, 'password': password});
                if (data == null) return false;
                return afterBrokeredAuth(data, username, ref);
              },
              onRegister: (username, email, password) async {
                final data = await postAuth('/api/auth/register',
                    {'username': username, 'email': email, 'password': password});
                if (data == null) return false;
                return afterBrokeredAuth(data, username, ref);
              },
            )),
        ..._overrides(deviceToken: deviceToken),
      ],
      child: const OhppApp(),
    );
  }

  /// App that starts ALREADY AUTHENTICATED with [identityToken]. Skips the UI
  /// login entirely so feature tests don't pay the Keycloak/login cost.
  Widget buildAppSignedIn({
    required String identityToken,
    required String deviceToken,
    String username = e2eTestUsername,
  }) {
    return ProviderScope(
      overrides: [
        // Seed the auth state so the app boots past the login screen.
        authProvider.overrideWith((ref) {
          final n = AuthNotifier();
          n.login(userId: username, accessToken: identityToken);
          return n;
        }),
        ..._overrides(deviceToken: deviceToken),
      ],
      child: const OhppApp(),
    );
  }
}

/// Keycloak resource-owner-password grant for arbitrary credentials (the auth
/// test needs to try wrong credentials too).
Future<String?> getAccessTokenFor(String username, String password) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse(
        '$e2eKeycloakUrl/realms/$e2eRealm/protocol/openid-connect/token'));
    request.headers.contentType =
        ContentType('application', 'x-www-form-urlencoded');
    request.write(Uri(queryParameters: {
      'grant_type': 'password',
      'client_id': e2eClientId,
      'username': username,
      'password': password,
    }).query);
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    if (response.statusCode != 200) return null;
    return (jsonDecode(body) as Map<String, dynamic>)['access_token'] as String?;
  } finally {
    client.close();
  }
}
