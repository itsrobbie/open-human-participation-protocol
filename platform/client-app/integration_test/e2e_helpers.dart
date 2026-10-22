import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Backend URLs for the dev stack (make dev).
///
/// Default to localhost so the simulator/CI path is unchanged. Override at
/// build time (e.g. running on a physical device that reaches the backend over
/// a LAN/tailnet host) via:
///   --dart-define=E2E_KEYCLOAK_URL=http://<host>:8080
///   --dart-define=E2E_RESOLVER_URL=http://<host>:5050
const e2eKeycloakUrl =
    String.fromEnvironment('E2E_KEYCLOAK_URL', defaultValue: 'http://localhost:8080');
const e2eResolverUrl =
    String.fromEnvironment('E2E_RESOLVER_URL', defaultValue: 'http://localhost:5050');
const e2eRealm = 'ohpp';
const e2eClientId = 'ohpp-portal';
const e2eTestUsername = 'demo';
const e2eTestPassword = 'demo';

/// Sets up the platform channel mock that bypasses biometric authentication
/// and provides test crypto signatures. This allows E2E tests to run on
/// simulators without real Secure Enclave or biometric hardware.
void setupPlatformChannelOverrides() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
    const MethodChannel('dev.ohpp/crypto'),
    (MethodCall call) async {
      switch (call.method) {
        case 'generateKeyPair':
          return {
            'publicKey': 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEe2eTestPublicKey',
            'keyRef': 'dev.ohpp.client.signing',
            'storageLevel': 'software', // simulator
          };
        case 'sign':
          final payload = call.arguments['payload'] as String;
          // Deterministic test signature based on payload hash
          final hash = payload.codeUnits.fold<int>(0, (acc, b) => (acc * 31 + b) & 0xFFFFFFFF);
          return {'signature': 'e2e-test-sig-${hash.toRadixString(16).padLeft(8, '0')}'};
        case 'getStorageLevel':
          return {'storageLevel': 'software'};
        case 'deleteKey':
          return {'deleted': true};
        default:
          return null;
      }
    },
  );
}

/// Tears down the platform channel mock.
void teardownPlatformChannelOverrides() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(const MethodChannel('dev.ohpp/crypto'), null);
}

/// Obtain a Keycloak access token for the demo user.
Future<String?> getAccessToken() async {
  final client = HttpClient();
  final request = await client.postUrl(
    Uri.parse('$e2eKeycloakUrl/realms/$e2eRealm/protocol/openid-connect/token'),
  );
  request.headers.contentType = ContentType('application', 'x-www-form-urlencoded');
  request.write(Uri(queryParameters: {
    'grant_type': 'password',
    'client_id': e2eClientId,
    'username': e2eTestUsername,
    'password': e2eTestPassword,
  }).query);

  final response = await request.close();
  final body = await response.transform(utf8.decoder).join();
  client.close();

  if (response.statusCode != 200) return null;
  final json = jsonDecode(body) as Map<String, dynamic>;
  return json['access_token'] as String?;
}

/// Create a device via the Portal API and return its device token.
/// This simulates the mobile device registration step.
Future<DeviceSetupResult?> setupDevice(String identityToken) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/devices'));
    request.headers.set('Authorization', 'Bearer $identityToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'name': 'E2E Test Device',
      'deviceType': 'ios-simulator',
    }));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 201) {
      final data = jsonDecode(body) as Map<String, dynamic>;
      return DeviceSetupResult(
        deviceId: data['id'] as String,
        deviceToken: data['deviceToken'] as String,
      );
    }
    return null;
  } finally {
    client.close();
  }
}

/// Register a public key for a device (simulates device key exchange).
Future<bool> registerDeviceKey(String deviceToken) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/devices/me/keys'));
    request.headers.set('Authorization', 'Bearer $deviceToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'publicKey': 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEe2eTestPublicKey',
      'algorithm': 'ES256',
    }));

    final response = await request.close();
    await response.drain<void>();
    return response.statusCode == 200;
  } finally {
    client.close();
  }
}

/// Register an app for the user (creates an app registration).
/// Returns the app access token if successful.
Future<AppRegistrationResult?> registerApp(String identityToken, String appId, String appName) async {
  final client = HttpClient();
  try {
    // Use the registration ceremony endpoint
    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/registrations'));
    request.headers.set('Authorization', 'Bearer $identityToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'appId': appId,
      'appName': appName,
    }));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(body) as Map<String, dynamic>;
      return AppRegistrationResult(
        registrationId: data['id'] as String? ?? data['registrationId'] as String? ?? '',
        accessToken: data['accessToken'] as String? ?? '',
      );
    }
    return null;
  } finally {
    client.close();
  }
}

/// Seed a participation request by having an app submit one via the protocol endpoint.
/// Requires an app access token from [registerApp].
Future<String?> seedParticipationRequest({
  required String appAccessToken,
  required String userId,
  required String appId,
  String type = 'select',
  String summary = 'E2E test: Approve this action',
  List<Map<String, String>>? options,
}) async {
  final client = HttpClient();
  try {
    final requestPayload = jsonEncode({
      'userId': userId,
      'type': type,
      'summary': summary,
      'appId': appId,
      if (options != null) 'options': options,
      if (options == null && type == 'select')
        'options': [
          {'key': 'approve', 'label': 'Approve'},
          {'key': 'reject', 'label': 'Reject'},
        ],
      'createdAt': DateTime.now().toUtc().toIso8601String(),
    });

    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/participate'));
    request.headers.set('Authorization', 'Bearer $appAccessToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({'payload': requestPayload}));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 201) {
      final data = jsonDecode(body) as Map<String, dynamic>;
      return data['requestId'] as String?;
    }
    return null;
  } finally {
    client.close();
  }
}

/// Submit an attestation for a pending request via the device API.
Future<bool> submitAttestation({
  required String deviceToken,
  required String requestId,
  String attestationPayload = '{"selectedOption":"approve"}',
  String deviceSignature = 'e2e-test-signature',
}) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/devices/me/attestations'));
    request.headers.set('Authorization', 'Bearer $deviceToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'requestId': requestId,
      'attestationPayload': attestationPayload,
      'deviceSignature': deviceSignature,
    }));

    final response = await request.close();
    await response.drain<void>();
    return response.statusCode == 200;
  } finally {
    client.close();
  }
}

/// Get pending requests for a device.
Future<List<Map<String, dynamic>>> getPendingRequests(String deviceToken) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse('$e2eResolverUrl/api/devices/me/pending'));
    request.headers.set('Authorization', 'Bearer $deviceToken');

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      final list = jsonDecode(body) as List;
      return list.cast<Map<String, dynamic>>();
    }
    return [];
  } finally {
    client.close();
  }
}

/// Get user's rules via the API.
Future<List<Map<String, dynamic>>> getRules(String identityToken) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse('$e2eResolverUrl/api/rules'));
    request.headers.set('Authorization', 'Bearer $identityToken');

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      final list = jsonDecode(body) as List;
      return list.cast<Map<String, dynamic>>();
    }
    return [];
  } finally {
    client.close();
  }
}

/// Create a rule via the API. Returns the rule ID.
Future<String?> createRule(String identityToken, Map<String, dynamic> ruleData) async {
  final client = HttpClient();
  try {
    final request = await client.postUrl(Uri.parse('$e2eResolverUrl/api/rules'));
    request.headers.set('Authorization', 'Bearer $identityToken');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(ruleData));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 201) {
      final data = jsonDecode(body) as Map<String, dynamic>;
      return data['id'] as String?;
    }
    return null;
  } finally {
    client.close();
  }
}

/// Delete a rule via the API.
Future<bool> deleteRule(String identityToken, String ruleId) async {
  final client = HttpClient();
  try {
    final request = await client.deleteUrl(Uri.parse('$e2eResolverUrl/api/rules/$ruleId'));
    request.headers.set('Authorization', 'Bearer $identityToken');

    final response = await request.close();
    await response.drain<void>();
    return response.statusCode == 204;
  } finally {
    client.close();
  }
}

/// Get registered apps for the user.
Future<List<Map<String, dynamic>>> getRegisteredApps(String identityToken) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse('$e2eResolverUrl/api/registrations/apps'));
    request.headers.set('Authorization', 'Bearer $identityToken');

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      final list = jsonDecode(body) as List;
      return list.cast<Map<String, dynamic>>();
    }
    return [];
  } finally {
    client.close();
  }
}

// --- Result types ---

class DeviceSetupResult {
  final String deviceId;
  final String deviceToken;
  const DeviceSetupResult({required this.deviceId, required this.deviceToken});
}

class AppRegistrationResult {
  final String registrationId;
  final String accessToken;
  const AppRegistrationResult({required this.registrationId, required this.accessToken});
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared E2E harness
//
// One place to (a) acquire a token once via the API and inject it so feature
// tests skip the UI login, (b) build the app wired to the real backend with the
// production composition (test-mode anti-agent: software ES256 signer +
// auto-approve biometric, selected by OHPP_ANTI_AGENT_MODE=test), and (c) clean
// up per-run artifacts so runs are repeatable.
//
// A dedicated auth test (auth_test.dart) still drives the real UI login. Every
// other feature test should call [buildAppSignedIn] to start already
// authenticated, cutting the Keycloak round-trip and the login UI overhead.
// ═══════════════════════════════════════════════════════════════════════════

/// Best-effort cleanup of the test user's connected artifacts so a run starts
/// from a known state. Revokes registered apps and devices via the public API.
/// Pending requests are self-cleaning: the approval flow resolves them, and
/// device/app registration is now idempotent, so this mainly trims leftovers
/// from interrupted runs.
Future<void> cleanupTestArtifacts(String identityToken) async {
  // Revoke registered apps.
  for (final app in await getRegisteredApps(identityToken)) {
    final id = app['id'] as String?;
    if (id == null) continue;
    final client = HttpClient();
    try {
      final req = await client
          .deleteUrl(Uri.parse('$e2eResolverUrl/api/registrations/apps/$id'));
      req.headers.set('Authorization', 'Bearer $identityToken');
      await (await req.close()).drain<void>();
    } catch (_) {
      // best-effort
    } finally {
      client.close();
    }
  }
  // Revoke devices.
  final client = HttpClient();
  try {
    final listReq =
        await client.getUrl(Uri.parse('$e2eResolverUrl/api/devices'));
    listReq.headers.set('Authorization', 'Bearer $identityToken');
    final listResp = await listReq.close();
    final body = await listResp.transform(utf8.decoder).join();
    if (listResp.statusCode == 200) {
      final devices = (jsonDecode(body) as List).cast<Map<String, dynamic>>();
      for (final d in devices) {
        final id = d['id'] as String?;
        if (id == null) continue;
        final delReq = await client
            .deleteUrl(Uri.parse('$e2eResolverUrl/api/devices/$id'));
        delReq.headers.set('Authorization', 'Bearer $identityToken');
        await (await delReq.close()).drain<void>();
      }
    }
  } catch (_) {
    // best-effort
  } finally {
    client.close();
  }
}

/// Fetches the Resolver participation-history detail for [requestId] using an
/// IdP (Keycloak `ohpp` realm) user token -- the audit/proof record written
/// once a ceremony resolves. Returns the decoded JSON (camelCase keys:
/// requestId, status, attestationPayload, decisionPayload, resolutionMethod,
/// resolvingDeviceId, resolvedAt, ...) or null on a non-200.
///
/// GET /api/history/{id} is guarded by RequireTokenType(IdentityProvider), so
/// pass the token from [getAccessToken], not a device token.
Future<Map<String, dynamic>?> fetchParticipationHistoryDetail({
  required String identityToken,
  required String requestId,
}) async {
  final client = HttpClient();
  try {
    final request =
        await client.getUrl(Uri.parse('$e2eResolverUrl/api/history/$requestId'));
    request.headers.set('Authorization', 'Bearer $identityToken');
    final response = await request.close();
    final body = await response.transform(const SystemEncoding().decoder).join();
    if (response.statusCode != 200) {
      return null;
    }
    return jsonDecode(body) as Map<String, dynamic>;
  } finally {
    client.close();
  }
}
