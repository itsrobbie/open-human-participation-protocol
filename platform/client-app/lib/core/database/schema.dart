import 'package:sqflite/sqflite.dart';

/// Database schema definitions and migration logic.
class DatabaseSchema {
  DatabaseSchema._();

  static Future<void> createAll(Database db) async {
    await db.execute('''
      CREATE TABLE participation_requests (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_name TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL,
        description TEXT,
        rationale TEXT,
        category TEXT,
        type TEXT NOT NULL,
        options_json TEXT,
        expiry TEXT,
        received_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        resolved_at TEXT,
        resolved_by TEXT,
        transaction_id TEXT,
        transaction_label TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE history_entries (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        app_name TEXT NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        category TEXT,
        status TEXT NOT NULL,
        decision_payload TEXT,
        resolution_method TEXT,
        resolving_device_id TEXT,
        transaction_id TEXT,
        transaction_label TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE app_registrations (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_name TEXT NOT NULL,
        app_icon TEXT,
        registered_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_request_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE participation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        app_id TEXT,
        priority INTEGER NOT NULL,
        auth_level TEXT NOT NULL,
        auto_respond_enabled INTEGER NOT NULL DEFAULT 0,
        auto_respond_option TEXT,
        auto_respond_value TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE rule_conditions (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        field TEXT NOT NULL,
        operator TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY (rule_id) REFERENCES participation_rules(id) ON DELETE CASCADE
      )
    ''');

    await db.execute('''
      CREATE TABLE notification_preferences (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        push_enabled INTEGER NOT NULL DEFAULT 1,
        sound_enabled INTEGER NOT NULL DEFAULT 1,
        badge_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE offline_queue (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        attestation_payload TEXT NOT NULL,
        device_signature TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TEXT,
        expires_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE observed_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        field_type TEXT NOT NULL,
        field_value TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(app_id, field_type, field_value)
      )
    ''');

    // Indexes for common queries
    await db.execute(
      'CREATE INDEX idx_requests_status ON participation_requests(status)',
    );
    await db.execute(
      'CREATE INDEX idx_history_created ON history_entries(created_at DESC)',
    );
    await db.execute(
      'CREATE INDEX idx_rules_priority ON participation_rules(priority)',
    );
    await db.execute(
      'CREATE INDEX idx_conditions_rule ON rule_conditions(rule_id)',
    );
    await db.execute(
      'CREATE INDEX idx_queue_status ON offline_queue(status)',
    );
    await db.execute(
      'CREATE UNIQUE INDEX idx_notif_pref_app ON notification_preferences(app_id)',
    );
  }

  static Future<void> migrate(
    Database db,
    int oldVersion,
    int newVersion,
  ) async {
    // Future migrations go here.
    // Example:
    // if (oldVersion < 2) { await _migrateV1ToV2(db); }
  }
}
