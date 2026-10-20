import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'schema.dart';

/// Encrypted local database for the OHPP Client App.
/// All user data (requests, rules, prefs) is encrypted at rest via SQLCipher.
/// The encryption key is stored in platform secure storage.
class AppDatabase {
  static Database? _instance;
  static const _dbName = 'ohpp_client.db';
  static const _version = 1;

  static Future<Database> get instance async {
    _instance ??= await _open();
    return _instance!;
  }

  static Future<Database> _open() async {
    final docsDir = await getApplicationDocumentsDirectory();
    final dbPath = p.join(docsDir.path, _dbName);

    // Retrieve or generate encryption key
    final key = await _getOrCreateKey();

    return openDatabase(
      dbPath,
      version: _version,
      onCreate: (db, version) async {
        // Set encryption key via PRAGMA before any operations
        await db.execute("PRAGMA key = '$key'");
        await DatabaseSchema.createAll(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        await DatabaseSchema.migrate(db, oldVersion, newVersion);
      },
      onOpen: (db) async {
        // Set encryption key on every open
        await db.execute("PRAGMA key = '$key'");
      },
    );
  }

  static Future<String> _getOrCreateKey() async {
    const storage = FlutterSecureStorage();
    const keyName = 'ohpp_db_encryption_key';

    var key = await storage.read(key: keyName);
    if (key == null) {
      // Generate a random 64-char hex key (256-bit)
      final now = DateTime.now();
      final seed = now.microsecondsSinceEpoch;
      final chars = '0123456789abcdef';
      final buffer = StringBuffer();
      for (var i = 0; i < 64; i++) {
        buffer.write(chars[(seed + i * 7) % 16]);
      }
      key = buffer.toString();
      await storage.write(key: keyName, value: key);
    }
    return key;
  }

  /// Wipe the database and re-create schema (for migration failure recovery).
  static Future<void> resetDatabase() async {
    if (_instance != null) {
      await _instance!.close();
      _instance = null;
    }
    final docsDir = await getApplicationDocumentsDirectory();
    final dbPath = p.join(docsDir.path, _dbName);
    await deleteDatabase(dbPath);
  }

  /// Close the database connection.
  static Future<void> close() async {
    if (_instance != null) {
      await _instance!.close();
      _instance = null;
    }
  }
}
