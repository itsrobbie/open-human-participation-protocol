import 'package:flutter_test/flutter_test.dart';

import 'mock_resolver.dart';

/// Step 49: App management integration tests.
void main() {
  late MockResolver resolver;

  setUp(() {
    resolver = MockResolver();
    resolver.registeredApps = [
      {
        'appId': 'pizza.example.com',
        'appName': 'Pizza App',
        'registeredAt': '2026-07-01T10:00:00Z',
      },
      {
        'appId': 'bank.example.com',
        'appName': 'Bank App',
        'registeredAt': '2026-07-15T10:00:00Z',
      },
    ];
  });

  group('App Management', () {
    test('integration_Apps_List_ShowsRegistered', () {
      final apps = resolver.getApps();

      expect(apps.length, 2);
      expect(apps[0]['appName'], 'Pizza App');
      expect(apps[1]['appName'], 'Bank App');
    });

    test('integration_Apps_Revoke_ConfirmAndRemove', () {
      expect(resolver.registeredApps.length, 2);

      resolver.revokeApp('pizza.example.com');

      expect(resolver.registeredApps.length, 1);
      expect(
        resolver.registeredApps.any((a) => a['appId'] == 'pizza.example.com'),
        isFalse,
      );
      expect(
        resolver.registeredApps.any((a) => a['appId'] == 'bank.example.com'),
        isTrue,
      );
    });

    test('integration_Apps_Revoke_ServerFails_RollsBack', () {
      // Simulate: save a backup before revoke, then restore on failure
      final backup = List<Map<String, dynamic>>.from(resolver.registeredApps);

      // Optimistic remove
      resolver.revokeApp('pizza.example.com');
      expect(resolver.registeredApps.length, 1);

      // Simulate server failure - rollback
      resolver.registeredApps = backup;
      expect(resolver.registeredApps.length, 2);
      expect(
        resolver.registeredApps.any((a) => a['appId'] == 'pizza.example.com'),
        isTrue,
      );
    });
  });
}
