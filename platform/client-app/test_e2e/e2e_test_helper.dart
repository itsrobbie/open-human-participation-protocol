import 'dart:convert';
import 'dart:io';

/// E2E test helper for Flutter client app.
/// Provides utilities for seeding data and interacting with the real Resolver.
class E2eTestHelper {
  final String resolverUrl;
  final String keycloakUrl;
  final HttpClient _client = HttpClient();

  static const testUsername = 'demo';
  static const testPassword = 'demo';
  static const clientId = 'ohpp-portal';

  E2eTestHelper({
    this.resolverUrl = 'http://localhost:5100',
    this.keycloakUrl = 'http://localhost:8081',
  });

  /// Get a valid access token from Keycloak for the test user.
  Future<String> getAccessToken() async {
    final request = await _client.postUrl(
      Uri.parse('$keycloakUrl/realms/ohpp/protocol/openid-connect/token'),
    );
    request.headers.contentType = ContentType('application', 'x-www-form-urlencoded');
    request.write(Uri(queryParameters: {
      'grant_type': 'password',
      'client_id': clientId,
      'username': testUsername,
      'password': testPassword,
    }).query);

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    final json = jsonDecode(body) as Map<String, dynamic>;

    if (json['access_token'] == null) {
      throw Exception('Failed to get access token: ${json['error'] ?? json['error_description'] ?? body}');
    }

    return json['access_token'] as String;
  }

  /// Create a participation request via the Resolver API (simulating an app).
  Future<Map<String, dynamic>> createParticipationRequest({
    required String token,
    required String appId,
    String summary = 'E2E test request',
    String type = 'select',
    List<Map<String, String>>? options,
  }) async {
    final request = await _client.postUrl(
      Uri.parse('$resolverUrl/api/participation-requests'),
    );
    request.headers.set('Authorization', 'Bearer $token');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'appId': appId,
      'summary': summary,
      'type': type,
      'options': options ?? [
        {'key': 'approve', 'label': 'Approve'},
        {'key': 'deny', 'label': 'Deny'},
      ],
    }));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    return jsonDecode(body) as Map<String, dynamic>;
  }

  /// Seed a test app registration.
  Future<void> seedAppRegistration({
    required String token,
    required String appId,
    String appName = 'E2E Test App',
  }) async {
    final request = await _client.postUrl(
      Uri.parse('$resolverUrl/api/registrations/seed'),
    );
    request.headers.set('Authorization', 'Bearer $token');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'appId': appId,
      'appName': appName,
    }));

    await request.close();
  }

  /// Check resolver health.
  Future<bool> isResolverHealthy() async {
    try {
      final request = await _client.getUrl(Uri.parse('$resolverUrl/health'));
      final response = await request.close();
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  void dispose() {
    _client.close();
  }
}
