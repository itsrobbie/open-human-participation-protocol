import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ohpp_client/app.dart';
import 'package:ohpp_client/features/login/login_screen.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

/// E2E integration tests running the real app against real Docker containers.
///
/// Prerequisites:
///   make dev (starts full backend stack)
///   Boot an iOS simulator
///
/// Run:
///   make flutter-test-e2e
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Real backend URLs (dev stack via 'make dev').
  // Default to localhost (simulator/CI). Override for a physical device that
  // reaches the backend over a LAN/tailnet host via --dart-define, e.g.:
  //   --dart-define=E2E_KEYCLOAK_URL=http://<host>:8080
  //   --dart-define=E2E_RESOLVER_URL=http://<host>:5050
  //   --dart-define=E2E_BANK_URL=http://<host>:5010
  const keycloakUrl = String.fromEnvironment('E2E_KEYCLOAK_URL',
      defaultValue: 'http://localhost:8080');
  const resolverUrl = String.fromEnvironment('E2E_RESOLVER_URL',
      defaultValue: 'http://localhost:5050');
  const bankUrl =
      String.fromEnvironment('E2E_BANK_URL', defaultValue: 'http://localhost:5010');
  const realm = 'ohpp';
  const clientId = 'ohpp-portal';
  const testUsername = 'demo';
  const testPassword = 'demo';

  /// Helper: obtain a Keycloak access token for the demo user.
  Future<String?> getAccessToken() async {
    final client = HttpClient();
    final request = await client.postUrl(
      Uri.parse('$keycloakUrl/realms/$realm/protocol/openid-connect/token'),
    );
    request.headers.contentType =
        ContentType('application', 'x-www-form-urlencoded');
    request.write(Uri(queryParameters: {
      'grant_type': 'password',
      'client_id': clientId,
      'username': testUsername,
      'password': testPassword,
    }).query);

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode != 200) return null;
    final json = jsonDecode(body) as Map<String, dynamic>;
    return json['access_token'] as String?;
  }

  /// Helper: seed a participation request via the Bank transfer API.
  /// Returns the transfer ID if successful.
  // ignore: unused_element
  Future<String?> seedPendingRequest(String token) async {
    final client = HttpClient();
    try {
      // Create a transfer that triggers a participation request
      final request = await client.postUrl(
        Uri.parse('$bankUrl/api/transfers'),
      );
      request.headers.set('Authorization', 'Bearer $token');
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({
        'accountId': 'acc-demo',
        'payeeId': 'payee-1',
        'amount': 250.00,
        'reference': 'E2E test transfer ${DateTime.now().millisecondsSinceEpoch}',
      }));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(body) as Map<String, dynamic>;
        return data['id'] as String? ?? data['transferId'] as String?;
      }
      return null;
    } catch (_) {
      return null;
    } finally {
      client.close();
    }
  }

  /// Helper: build the app with real backend data sources.
  Widget buildApp(Ref Function(Ref) refCallback) {
    return ProviderScope(
      overrides: [
        loginProvider.overrideWith((ref) {
          return LoginNotifier(onLogin: (username, password) async {
            final client = HttpClient();
            final request = await client.postUrl(
              Uri.parse(
                  '$keycloakUrl/realms/$realm/protocol/openid-connect/token'),
            );
            request.headers.contentType =
                ContentType('application', 'x-www-form-urlencoded');
            request.write(Uri(queryParameters: {
              'grant_type': 'password',
              'client_id': clientId,
              'username': username,
              'password': password,
            }).query);

            final response = await request.close();
            final body = await response.transform(utf8.decoder).join();
            client.close();

            if (response.statusCode != 200) return false;

            final json = jsonDecode(body) as Map<String, dynamic>;
            final token = json['access_token'] as String?;
            if (token == null) return false;

            ref.read(authProvider.notifier).login(
              userId: username,
              accessToken: token,
            );
            return true;
          });
        }),
        pendingProvider.overrideWith((ref) {
          return PendingNotifier(
              dataSource: _ResolverPendingSource(resolverUrl, ref));
        }),
        historyProvider.overrideWith((ref) {
          return HistoryNotifier(
              dataSource: _ResolverHistorySource(resolverUrl, ref));
        }),
        rulesProvider.overrideWith((ref) {
          return RulesNotifier(
              dataSource: _ResolverRulesSource(resolverUrl, ref));
        }),
        appsProvider.overrideWith((ref) {
          return AppsNotifier(
              dataSource: _ResolverAppsSource(resolverUrl, ref));
        }),
      ],
      child: const OhppApp(),
    );
  }

  /// Pump repeatedly until [finder] matches or [timeout] elapses. Avoids
  /// flaky fixed-duration waits when the backend is reached over the network.
  Future<void> pumpUntilFound(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 500));
      if (finder.evaluate().isNotEmpty) return;
    }
    // Let the final frame settle; the caller's expect() will report if missing.
    await tester.pumpAndSettle();
  }

  /// Helper: login and navigate to Pending screen.
  Future<void> loginAndWait(WidgetTester tester) async {
    await tester.enterText(
        find.byKey(const Key('login-username')), testUsername);
    await tester.enterText(
        find.byKey(const Key('login-password')), testPassword);
    await tester.pumpAndSettle();
    // Dismiss the on-screen keyboard WITHOUT submitting the form. (Using the
    // "done" text-input action would trigger the password field's
    // onFieldSubmitted -> _submit(), logging in early and removing the button
    // before we can scroll to / tap it.) Unfocusing just closes the keyboard.
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    // The submit button sits at the bottom of a SingleChildScrollView; scroll it
    // into view so the tap actually hits it on a real device.
    final submit = find.byKey(const Key('login-submit'));
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
    // Auth is a real network round-trip to Keycloak (slower over a LAN/tailnet
    // host than localhost on the simulator). Poll for the post-login screen
    // instead of a fixed delay so the wait scales with real latency.
    await pumpUntilFound(tester, find.text('Pending'),
        timeout: const Duration(seconds: 30));
  }

  group('E2E User Journeys (Real Backend)', () {
    testWidgets('Login: authenticates against real Keycloak', (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      expect(find.text('OHPP'), findsOneWidget);
      expect(find.byKey(const Key('login-username')), findsOneWidget);

      await loginAndWait(tester);

      // Should have navigated away from login (auth succeeded)
      expect(find.text('Pending'), findsWidgets);
    });

    testWidgets('Login: rejects invalid credentials from Keycloak',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            loginProvider.overrideWith((ref) {
              return LoginNotifier(onLogin: (username, password) async {
                final client = HttpClient();
                try {
                  final request = await client.postUrl(
                    Uri.parse(
                        '$keycloakUrl/realms/$realm/protocol/openid-connect/token'),
                  );
                  request.headers.contentType =
                      ContentType('application', 'x-www-form-urlencoded');
                  request.write(Uri(queryParameters: {
                    'grant_type': 'password',
                    'client_id': clientId,
                    'username': username,
                    'password': password,
                  }).query);

                  final response = await request.close();
                  await response.drain<void>();

                  if (response.statusCode != 200) return false;
                  return true;
                } catch (_) {
                  return false;
                } finally {
                  client.close();
                }
              });
            }),
            pendingProvider.overrideWith((ref) {
              return PendingNotifier(dataSource: _EmptyPendingSource());
            }),
            rulesProvider.overrideWith((ref) {
              return RulesNotifier(dataSource: _EmptyRulesSource());
            }),
            appsProvider.overrideWith((ref) {
              return AppsNotifier(dataSource: _EmptyAppsSource());
            }),
          ],
          child: const OhppApp(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
          find.byKey(const Key('login-username')), 'wrong');
      await tester.enterText(
          find.byKey(const Key('login-password')), 'wrong');
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Should still be on login screen
      expect(find.byKey(const Key('login-username')), findsOneWidget);
      expect(find.text('Pending'), findsNothing);
    });

    testWidgets('Resolver health: API is reachable', (tester) async {
      final client = HttpClient();
      final request = await client.getUrl(Uri.parse('$resolverUrl/health'));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      client.close();

      expect(response.statusCode, 200);
      expect(body, contains('healthy'));
    });

    testWidgets('Pending: displays requests from Resolver', (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Wait for pending requests to load
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Should see the Pending tab active with list or empty state
      expect(find.text('Pending'), findsWidgets);
      // Either shows pending cards or empty state
      final hasPendingCards =
          find.byKey(const Key('pending-list')).evaluate().isNotEmpty;
      final hasEmptyState =
          find.byKey(const Key('pending-empty')).evaluate().isNotEmpty;
      expect(hasPendingCards || hasEmptyState, isTrue);
    });

    testWidgets('History: view participation history after login',
        (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Navigate to History tab
      await tester.tap(find.byKey(const Key('tab-history')));
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Should show History screen content
      expect(find.text('History'), findsWidgets);
      // Either has history entries or empty state
      final hasHistoryList =
          find.byKey(const Key('history-list')).evaluate().isNotEmpty;
      final hasEmptyState =
          find.byKey(const Key('history-empty')).evaluate().isNotEmpty;
      expect(hasHistoryList || hasEmptyState, isTrue);
    });

    testWidgets('Apps: view registered apps after login', (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Navigate to Apps tab
      await tester.tap(find.byKey(const Key('tab-apps')));
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Should show Apps screen content
      expect(find.text('Apps'), findsWidgets);
      // Either has app cards or empty state
      final hasAppsList =
          find.byKey(const Key('apps-list')).evaluate().isNotEmpty;
      final hasEmptyState =
          find.byKey(const Key('apps-empty')).evaluate().isNotEmpty;
      expect(hasAppsList || hasEmptyState, isTrue);
    });

    testWidgets('Rules: create and delete a rule via real API',
        (tester) async {
      // First clean up any existing test rules
      final token = await getAccessToken();
      if (token != null) {
        final client = HttpClient();
        final listRequest =
            await client.getUrl(Uri.parse('$resolverUrl/api/rules'));
        listRequest.headers.set('Authorization', 'Bearer $token');
        final listResponse = await listRequest.close();
        final listBody = await listResponse.transform(utf8.decoder).join();
        client.close();

        if (listResponse.statusCode == 200) {
          final rules = jsonDecode(listBody) as List;
          for (final rule in rules) {
            final ruleMap = rule as Map<String, dynamic>;
            if ((ruleMap['name'] as String? ?? '').startsWith('E2E Test')) {
              final deleteClient = HttpClient();
              final deleteRequest = await deleteClient.deleteUrl(
                  Uri.parse('$resolverUrl/api/rules/${ruleMap['id']}'));
              deleteRequest.headers.set('Authorization', 'Bearer $token');
              await deleteRequest.close();
              deleteClient.close();
            }
          }
        }
      }

      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Navigate to Rules via drawer
      // Open drawer
      final scaffoldFinder = find.byType(Scaffold).first;
      final scaffoldState =
          tester.state<ScaffoldState>(scaffoldFinder);
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      // Tap Rules menu item
      await tester.tap(find.byKey(const Key('drawer-rules')));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Should see Rules screen
      expect(find.text('Rules'), findsWidgets);

      // Tap FAB to create new rule
      await tester.tap(find.byKey(const Key('rules-fab')));
      await tester.pumpAndSettle();

      // Should show rule editor
      expect(find.text('New Rule'), findsOneWidget);

      // Enter rule name
      await tester.enterText(
          find.byKey(const Key('rule-name-field')),
          'E2E Test Rule ${DateTime.now().millisecondsSinceEpoch}');
      await tester.pumpAndSettle();

      // Save the rule
      await tester.tap(find.byKey(const Key('rule-save-button')));
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      // Should navigate back to rules list
      // Verify the rule was created by checking the API
      if (token != null) {
        final verifyClient = HttpClient();
        final verifyRequest =
            await verifyClient.getUrl(Uri.parse('$resolverUrl/api/rules'));
        verifyRequest.headers.set('Authorization', 'Bearer $token');
        final verifyResponse = await verifyRequest.close();
        final verifyBody =
            await verifyResponse.transform(utf8.decoder).join();
        verifyClient.close();

        if (verifyResponse.statusCode == 200) {
          final rules = jsonDecode(verifyBody) as List;
          final e2eRules = rules
              .cast<Map<String, dynamic>>()
              .where((r) =>
                  (r['name'] as String? ?? '').startsWith('E2E Test'))
              .toList();
          expect(e2eRules, isNotEmpty,
              reason: 'E2E rule should exist after creation');

          // Clean up: delete the test rule
          for (final rule in e2eRules) {
            final cleanupClient = HttpClient();
            final cleanupRequest = await cleanupClient.deleteUrl(
                Uri.parse('$resolverUrl/api/rules/${rule['id']}'));
            cleanupRequest.headers.set('Authorization', 'Bearer $token');
            await cleanupRequest.close();
            cleanupClient.close();
          }
        }
      }
    });

    testWidgets('Navigation: tab switching works across all tabs',
        (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Start on Pending
      expect(find.text('Pending'), findsWidgets);

      // Switch to History
      await tester.tap(find.byKey(const Key('tab-history')));
      await tester.pumpAndSettle();
      expect(find.text('History'), findsWidgets);

      // Switch to Apps
      await tester.tap(find.byKey(const Key('tab-apps')));
      await tester.pumpAndSettle();
      expect(find.text('Apps'), findsWidgets);

      // Switch to Profile
      await tester.tap(find.byKey(const Key('tab-profile')));
      await tester.pumpAndSettle();

      // Switch back to Pending
      await tester.tap(find.byKey(const Key('tab-pending')));
      await tester.pumpAndSettle();
      expect(find.text('Pending'), findsWidgets);
    });

    testWidgets('Drawer: navigation to settings screens', (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);

      // Open drawer
      final scaffoldFinder = find.byType(Scaffold).first;
      final scaffoldState =
          tester.state<ScaffoldState>(scaffoldFinder);
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      // Verify drawer items visible
      expect(find.byKey(const Key('drawer-settings')), findsOneWidget);
      expect(find.byKey(const Key('drawer-appearance')), findsOneWidget);
      expect(find.byKey(const Key('drawer-security')), findsOneWidget);
      expect(find.byKey(const Key('drawer-notifications')), findsOneWidget);
      expect(find.byKey(const Key('drawer-rules')), findsOneWidget);
      expect(find.byKey(const Key('drawer-logout')), findsOneWidget);
    });

    testWidgets('Logout: returns to login screen', (tester) async {
      await tester.pumpWidget(buildApp((ref) => ref));
      await tester.pumpAndSettle();

      await loginAndWait(tester);
      expect(find.text('Pending'), findsWidgets);

      // Open drawer and logout
      final scaffoldFinder = find.byType(Scaffold).first;
      final scaffoldState =
          tester.state<ScaffoldState>(scaffoldFinder);
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('drawer-logout')));
      await tester.pumpAndSettle();

      // Should be back on login screen
      expect(find.byKey(const Key('login-username')), findsOneWidget);
      expect(find.text('OHPP'), findsOneWidget);
    });
  });
}

// --- Real backend data sources ---

class _ResolverPendingSource implements PendingDataSource {
  final String _baseUrl;
  final Ref _ref;
  _ResolverPendingSource(this._baseUrl, this._ref);

  String? get _token => _ref.read(authProvider).accessToken;

  @override
  List<Map<String, dynamic>> getCached() => [];

  @override
  Future<List<Map<String, dynamic>>> fetchPending() async {
    if (_token == null) return [];
    final client = HttpClient();
    final request = await client
        .getUrl(Uri.parse('$_baseUrl/api/participation-requests/pending'));
    request.headers.set('Authorization', 'Bearer $_token');
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode != 200) return [];
    final list = jsonDecode(body) as List;
    return list.cast<Map<String, dynamic>>();
  }
}

class _ResolverHistorySource implements HistoryDataSource {
  final String _baseUrl;
  final Ref _ref;
  _ResolverHistorySource(this._baseUrl, this._ref);

  String? get _token => _ref.read(authProvider).accessToken;

  @override
  Future<Map<String, dynamic>> fetchHistory(
      {required int page, required int pageSize}) async {
    if (_token == null) return {'items': [], 'totalCount': 0};
    final client = HttpClient();
    final request = await client.getUrl(
      Uri.parse(
          '$_baseUrl/api/participation-requests/history?page=$page&pageSize=$pageSize'),
    );
    request.headers.set('Authorization', 'Bearer $_token');
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode != 200) return {'items': [], 'totalCount': 0};
    return jsonDecode(body) as Map<String, dynamic>;
  }
}

class _ResolverRulesSource implements RulesDataSource {
  final String _baseUrl;
  final Ref _ref;
  _ResolverRulesSource(this._baseUrl, this._ref);

  String? get _token => _ref.read(authProvider).accessToken;

  @override
  Future<List<Map<String, dynamic>>> fetchRules() async {
    if (_token == null) return [];
    final client = HttpClient();
    final request = await client.getUrl(Uri.parse('$_baseUrl/api/rules'));
    request.headers.set('Authorization', 'Bearer $_token');
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode != 200) return [];
    final list = jsonDecode(body) as List;
    return list.cast<Map<String, dynamic>>();
  }

  @override
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data) async {
    final client = HttpClient();
    final request = await client.postUrl(Uri.parse('$_baseUrl/api/rules'));
    request.headers.set('Authorization', 'Bearer $_token');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(data));
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(body) as Map<String, dynamic>;
    }
    return data; // Fallback: return input data if API rejects
  }

  @override
  Future<Map<String, dynamic>> updateRule(
      String id, Map<String, dynamic> data) async {
    final client = HttpClient();
    final request = await client.putUrl(Uri.parse('$_baseUrl/api/rules/$id'));
    request.headers.set('Authorization', 'Bearer $_token');
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(data));
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();
    if (response.statusCode == 200) {
      return jsonDecode(body) as Map<String, dynamic>;
    }
    return {...data, 'id': id};
  }

  @override
  Future<void> deleteRule(String id) async {
    final client = HttpClient();
    final request =
        await client.deleteUrl(Uri.parse('$_baseUrl/api/rules/$id'));
    request.headers.set('Authorization', 'Bearer $_token');
    await request.close();
    client.close();
  }
}

class _ResolverAppsSource implements AppsDataSource {
  final String _baseUrl;
  final Ref _ref;
  _ResolverAppsSource(this._baseUrl, this._ref);

  String? get _token => _ref.read(authProvider).accessToken;

  @override
  Future<List<Map<String, dynamic>>> fetchApps() async {
    if (_token == null) return [];
    final client = HttpClient();
    final request =
        await client.getUrl(Uri.parse('$_baseUrl/api/registrations'));
    request.headers.set('Authorization', 'Bearer $_token');
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    client.close();

    if (response.statusCode != 200) return [];
    final list = jsonDecode(body) as List;
    return list.cast<Map<String, dynamic>>();
  }

  @override
  Future<void> revokeApp(String appId) async {
    final client = HttpClient();
    final request = await client
        .deleteUrl(Uri.parse('$_baseUrl/api/registrations/$appId'));
    request.headers.set('Authorization', 'Bearer $_token');
    await request.close();
    client.close();
  }

  @override
  Future<void> setNotificationPreference(String appId, bool enabled) async {}

  @override
  Future<Map<String, dynamic>> processChallenge(String base64Payload) async => {};
}

// --- Fallback empty sources for tests that don't need real data ---

class _EmptyPendingSource implements PendingDataSource {
  @override
  List<Map<String, dynamic>> getCached() => [];
  @override
  Future<List<Map<String, dynamic>>> fetchPending() async => [];
}

class _EmptyRulesSource implements RulesDataSource {
  @override
  Future<List<Map<String, dynamic>>> fetchRules() async => [];
  @override
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data) async =>
      data;
  @override
  Future<Map<String, dynamic>> updateRule(String id, Map<String, dynamic> data) async =>
      {...data, 'id': id};
  @override
  Future<void> deleteRule(String id) async {}
}

class _EmptyAppsSource implements AppsDataSource {
  @override
  Future<List<Map<String, dynamic>>> fetchApps() async => [];
  @override
  Future<void> revokeApp(String appId) async {}

  @override
  Future<void> setNotificationPreference(String appId, bool enabled) async {}

  @override
  Future<Map<String, dynamic>> processChallenge(String base64Payload) async => {};
}
