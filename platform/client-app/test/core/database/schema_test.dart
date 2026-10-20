import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:ohpp_client/core/database/schema.dart';

void main() {
  // Use ffi database for testing (in-memory, no encryption needed for schema tests)
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  group('DatabaseSchema', () {
    test('Database_CreatesAllTables_NoErrors', () async {
      final db = await openDatabase(
        inMemoryDatabasePath,
        version: 1,
        onCreate: (db, version) async {
          await DatabaseSchema.createAll(db);
        },
      );

      // Verify all tables exist by querying sqlite_master
      final tables = await db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      final tableNames = tables.map((t) => t['name'] as String).toSet();

      expect(tableNames, contains('participation_requests'));
      expect(tableNames, contains('history_entries'));
      expect(tableNames, contains('app_registrations'));
      expect(tableNames, contains('participation_rules'));
      expect(tableNames, contains('rule_conditions'));
      expect(tableNames, contains('notification_preferences'));
      expect(tableNames, contains('offline_queue'));
      expect(tableNames, contains('observed_fields'));

      await db.close();
    });

    test('Database_InsertAndQuery_RoundTrips', () async {
      final db = await openDatabase(
        inMemoryDatabasePath,
        version: 1,
        onCreate: (db, version) async {
          await DatabaseSchema.createAll(db);
        },
      );

      // Insert a rule
      await db.insert('participation_rules', {
        'id': 'rule-1',
        'name': 'Test Rule',
        'priority': 1,
        'auth_level': 'biometric',
        'auto_respond_enabled': 0,
        'enabled': 1,
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      });

      // Query back
      final rules = await db.query('participation_rules');
      expect(rules.length, equals(1));
      expect(rules.first['name'], equals('Test Rule'));
      expect(rules.first['auth_level'], equals('biometric'));

      await db.close();
    });

    test('Database_Migration_V1CreatesSchema', () async {
      // Migration V1 is the same as onCreate - verify it doesn't throw
      final db = await openDatabase(
        inMemoryDatabasePath,
        version: 1,
        onCreate: (db, version) async {
          await DatabaseSchema.createAll(db);
        },
      );

      // Verify indexes exist
      final indexes = await db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      );
      final indexNames = indexes.map((i) => i['name'] as String).toSet();

      expect(indexNames, contains('idx_requests_status'));
      expect(indexNames, contains('idx_history_created'));
      expect(indexNames, contains('idx_rules_priority'));
      expect(indexNames, contains('idx_conditions_rule'));
      expect(indexNames, contains('idx_queue_status'));
      expect(indexNames, contains('idx_notif_pref_app'));

      await db.close();
    });

    test('Database_ForeignKey_RuleConditionsCascade', () async {
      final db = await openDatabase(
        inMemoryDatabasePath,
        version: 1,
        onCreate: (db, version) async {
          await db.execute('PRAGMA foreign_keys = ON');
          await DatabaseSchema.createAll(db);
        },
      );
      await db.execute('PRAGMA foreign_keys = ON');

      // Insert rule + condition
      await db.insert('participation_rules', {
        'id': 'rule-cascade',
        'name': 'Cascade Test',
        'priority': 1,
        'auth_level': 'none',
        'auto_respond_enabled': 0,
        'enabled': 1,
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      });
      await db.insert('rule_conditions', {
        'id': 'cond-1',
        'rule_id': 'rule-cascade',
        'field': 'category',
        'operator': 'equals',
        'value': 'payment',
      });

      // Delete rule
      await db.delete('participation_rules', where: 'id = ?', whereArgs: ['rule-cascade']);

      // Condition should be gone (cascade)
      final conditions = await db.query('rule_conditions', where: 'rule_id = ?', whereArgs: ['rule-cascade']);
      expect(conditions, isEmpty);

      await db.close();
    });
  });
}
