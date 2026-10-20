/// Mock Resolver API for integration testing.
/// Provides controllable responses for all API endpoints.
class MockResolver {
  // Auth
  String? validUsername = 'testuser';
  String? validPassword = 'password123';
  String accessToken = 'mock-access-token';
  String refreshToken = 'mock-refresh-token';
  bool refreshShouldFail = false;

  // Pending requests
  List<Map<String, dynamic>> pendingRequests = [];

  // History
  List<Map<String, dynamic>> historyEntries = [];

  // Apps
  List<Map<String, dynamic>> registeredApps = [];

  // Rules
  List<Map<String, dynamic>> rules = [];

  // Registration
  bool registrationShouldSucceed = true;
  String? registrationError;

  // Attestation submission
  bool submitShouldSucceed = true;
  bool submitShouldConflict = false;

  // --- Auth endpoints ---

  Map<String, dynamic> login(String username, String password) {
    if (username == validUsername && password == validPassword) {
      return {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'expires_in': 300,
      };
    }
    throw MockApiError(401, 'Invalid credentials');
  }

  Map<String, dynamic> refresh(String token) {
    if (refreshShouldFail) {
      throw MockApiError(401, 'Refresh token expired');
    }
    return {
      'access_token': 'refreshed-token-${DateTime.now().millisecondsSinceEpoch}',
      'refresh_token': refreshToken,
      'expires_in': 300,
    };
  }

  // --- Pending endpoints ---

  List<Map<String, dynamic>> getPending() => pendingRequests;

  // --- History endpoints ---

  Map<String, dynamic> getHistory({int page = 1, int pageSize = 20}) {
    final start = (page - 1) * pageSize;
    final end = start + pageSize;
    final items = historyEntries.length > start
        ? historyEntries.sublist(start, end.clamp(0, historyEntries.length))
        : <Map<String, dynamic>>[];
    return {
      'items': items,
      'totalCount': historyEntries.length,
    };
  }

  // --- Apps endpoints ---

  List<Map<String, dynamic>> getApps() => registeredApps;

  void revokeApp(String appId) {
    registeredApps.removeWhere((a) => a['appId'] == appId);
  }

  // --- Rules endpoints ---

  List<Map<String, dynamic>> getRules() => rules;

  Map<String, dynamic> createRule(Map<String, dynamic> data) {
    final rule = {
      ...data,
      'id': data['id'] as String? ?? 'rule-${DateTime.now().millisecondsSinceEpoch}',
    };
    rules.add(rule);
    return rule;
  }

  void deleteRule(String id) {
    rules.removeWhere((r) => r['id'] == id);
  }

  void reorderRules(List<String> ids) {
    final reordered = <Map<String, dynamic>>[];
    for (final id in ids) {
      final rule = rules.firstWhere((r) => r['id'] == id);
      reordered.add(rule);
    }
    rules = reordered;
  }

  // --- Registration endpoint ---

  Map<String, dynamic> processChallenge(String challengePayload) {
    if (!registrationShouldSucceed) {
      throw MockApiError(400, registrationError ?? 'Invalid challenge');
    }
    final app = {
      'appId': 'new-app.example.com',
      'appName': 'New App',
      'registeredAt': DateTime.now().toIso8601String(),
    };
    registeredApps.add(app);
    return app;
  }

  // --- Attestation endpoint ---

  Map<String, dynamic> submitAttestation(Map<String, dynamic> payload) {
    if (submitShouldConflict) {
      throw MockApiError(409, 'Already resolved');
    }
    if (!submitShouldSucceed) {
      throw MockApiError(500, 'Server error');
    }
    // Move from pending to history
    final requestId = payload['requestId'] as String;
    pendingRequests.removeWhere((r) => r['requestId'] == requestId);
    historyEntries.insert(0, {
      'id': 'hist-${DateTime.now().millisecondsSinceEpoch}',
      'requestId': requestId,
      'appId': payload['appId'] ?? 'test.app',
      'summary': 'Completed request',
      'status': 'resolved',
      'decision': payload['decision'] ?? 'approve',
      'timestamp': DateTime.now().toIso8601String(),
    });
    return {'status': 'ok'};
  }
}

class MockApiError implements Exception {
  final int statusCode;
  final String message;

  MockApiError(this.statusCode, this.message);

  @override
  String toString() => 'MockApiError($statusCode): $message';
}
