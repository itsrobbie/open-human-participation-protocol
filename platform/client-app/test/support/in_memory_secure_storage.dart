import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// Returns a real [FlutterSecureStorage] whose platform channel is backed by an
/// in-memory map, so unit tests can read/write without a device keychain.
///
/// flutter_secure_storage talks to the platform over the
/// `plugins.it_nomads.com/flutter_secure_storage` MethodChannel; we mock that
/// channel with a simple store. Call once per test (each call resets the store).
FlutterSecureStorage inMemorySecureStorage() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final store = <String, String>{};
  const channel =
      MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (MethodCall call) async {
    final args = (call.arguments as Map?)?.cast<String, dynamic>() ?? {};
    switch (call.method) {
      case 'write':
        store[args['key'] as String] = args['value'] as String;
        return null;
      case 'read':
        return store[args['key'] as String];
      case 'delete':
        store.remove(args['key'] as String);
        return null;
      case 'deleteAll':
        store.clear();
        return null;
      case 'readAll':
        return Map<String, String>.from(store);
      case 'containsKey':
        return store.containsKey(args['key'] as String);
      default:
        return null;
    }
  });

  return const FlutterSecureStorage();
}


