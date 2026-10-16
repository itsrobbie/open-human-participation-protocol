// Minimal on-device smoke test — the first rung of the physical-device ladder.
//
// It deliberately avoids login and widget interaction so it isolates the
// device pipeline itself (build -> sign -> install -> launch -> driver attach
// -> reach the backend over the LAN/tailnet host). Once this is green on the
// real device, the fuller journeys in app_test.dart build on top of it.
//
// Run via `flutter drive` on a wired device, e.g. `make flutter-e2e-device`
// (which passes the E2E_* --dart-defines pointing at the dev backend).
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Backend host: localhost by default (simulator/CI); overridden on a physical
  // device via --dart-define=E2E_RESOLVER_URL=http://<host>:5050.
  const resolverUrl =
      String.fromEnvironment('E2E_RESOLVER_URL', defaultValue: 'http://localhost:5050');

  testWidgets('smoke: resolver /health is reachable from the device',
      (tester) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(Uri.parse('$resolverUrl/health'));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      expect(response.statusCode, 200);
      expect(body, contains('healthy'));
    } finally {
      client.close();
    }
  });
}
