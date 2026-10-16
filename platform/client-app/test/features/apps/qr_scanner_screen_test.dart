import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';
import 'package:ohpp_client/features/apps/qr_scanner_screen.dart';

void main() {
  Widget buildScanner({
    QrScannerState initialState = QrScannerState.scanning,
    String? errorMessage,
    ThemeData? theme,
    void Function(String)? onResult,
  }) {
    return ProviderScope(
      child: MaterialApp(
        theme: theme ?? AppTheme.light(),
        home: QrScannerScreen(
          testMode: true,
          initialState: initialState,
          errorMessage: errorMessage,
          onResult: onResult ?? (_) {},
        ),
      ),
    );
  }

  group('QRScannerScreen', () {
    testWidgets('Scanner_Opens_ShowsCamera', (tester) async {
      await tester.pumpWidget(buildScanner());
      await tester.pumpAndSettle();

      // In test mode, shows a placeholder instead of actual camera
      expect(find.byKey(const Key('scanner-viewfinder')), findsOneWidget);
      expect(find.byKey(const Key('scanner-frame-overlay')), findsOneWidget);
    });

    testWidgets('Scanner_FlashToggle_Works', (tester) async {
      await tester.pumpWidget(buildScanner());
      await tester.pumpAndSettle();

      final flashButton = find.byKey(const Key('scanner-flash-toggle'));
      expect(flashButton, findsOneWidget);

      // Tap flash toggle
      await tester.tap(flashButton);
      await tester.pumpAndSettle();

      // Icon should change to flash_on
      expect(find.byIcon(Icons.flash_on), findsOneWidget);
    });

    testWidgets('Scanner_QRDetected_ProcessesChallenge', (tester) async {
      await tester.pumpWidget(buildScanner(
        initialState: QrScannerState.processing,
      ));
      await tester.pump();

      expect(find.byKey(const Key('scanner-processing')), findsOneWidget);
      expect(find.text('Processing...'), findsOneWidget);
    });

    testWidgets('Scanner_Cancel_ReturnsToApps', (tester) async {
      bool cancelled = false;
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: QrScannerScreen(
            testMode: true,
            onCancel: () => cancelled = true,
            onResult: (_) {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('scanner-cancel')));
      await tester.pumpAndSettle();

      expect(cancelled, isTrue);
    });

    testWidgets('Scanner_InvalidQR_ShowsError', (tester) async {
      await tester.pumpWidget(buildScanner(
        initialState: QrScannerState.error,
        errorMessage: 'Invalid QR code. Not an OHPP registration link.',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('scanner-error')), findsOneWidget);
      expect(find.text('Invalid QR code. Not an OHPP registration link.'), findsOneWidget);
      expect(find.byKey(const Key('scanner-retry')), findsOneWidget);
    });
  });

  group('Golden tests - qr scanner', () {
    testWidgets('qr_scanner_light', (tester) async {
      await tester.pumpWidget(buildScanner());
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/qr_scanner_light.png'),
      );
    });

    testWidgets('qr_scanner_dark', (tester) async {
      await tester.pumpWidget(buildScanner(theme: AppTheme.dark()));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/qr_scanner_dark.png'),
      );
    });

    testWidgets('qr_scanner_processing_light', (tester) async {
      await tester.pumpWidget(buildScanner(
        initialState: QrScannerState.processing,
      ));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/qr_scanner_processing_light.png'),
      );
    });

    testWidgets('qr_scanner_processing_dark', (tester) async {
      await tester.pumpWidget(buildScanner(
        initialState: QrScannerState.processing,
        theme: AppTheme.dark(),
      ));
      await tester.pump();

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/qr_scanner_processing_dark.png'),
      );
    });
  });
}
