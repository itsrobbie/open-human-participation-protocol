import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/api/pinning_interceptor.dart';

void main() {
  group('PinningInterceptor', () {
    test('can be constructed with pinned hashes', () {
      final interceptor = PinningInterceptor(
        pinnedHashes: ['sha256/abc123', 'sha256/def456'],
      );

      expect(interceptor.pinnedHashes.length, equals(2));
      expect(interceptor.enabled, isTrue);
    });

    test('can be disabled for test environments', () {
      final interceptor = PinningInterceptor(
        pinnedHashes: ['sha256/abc123'],
        enabled: false,
      );

      expect(interceptor.enabled, isFalse);
    });

    test('configure does nothing when disabled', () {
      final interceptor = PinningInterceptor(
        pinnedHashes: ['sha256/abc123'],
        enabled: false,
      );
      final dio = Dio();

      // Should not throw
      interceptor.configure(dio);
    });

    test('configure does nothing when no hashes', () {
      final interceptor = PinningInterceptor(
        pinnedHashes: [],
      );
      final dio = Dio();

      // Should not throw
      interceptor.configure(dio);
    });
  });

  group('CertificatePinningException', () {
    test('contains host and message', () {
      final exception = CertificatePinningException(
        host: 'resolver.ohpp.dev',
        message: 'Pin mismatch',
      );

      expect(exception.host, equals('resolver.ohpp.dev'));
      expect(exception.message, equals('Pin mismatch'));
      expect(exception.toString(), contains('resolver.ohpp.dev'));
    });
  });
}
