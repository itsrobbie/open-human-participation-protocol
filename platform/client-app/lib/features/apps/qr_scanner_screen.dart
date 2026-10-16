import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// State of the QR scanner screen.
enum QrScannerState {
  scanning,
  processing,
  error,
}

/// QR code scanner for registration challenges.
///
/// In test mode ([testMode] = true), shows a placeholder instead of the real
/// camera to allow widget testing without platform dependencies.
class QrScannerScreen extends StatefulWidget {
  final bool testMode;
  final QrScannerState initialState;
  final String? errorMessage;
  final void Function(String value) onResult;
  final VoidCallback? onCancel;

  const QrScannerScreen({
    super.key,
    this.testMode = false,
    this.initialState = QrScannerState.scanning,
    this.errorMessage,
    required this.onResult,
    this.onCancel,
  });

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  late QrScannerState _state;
  String? _errorMessage;
  bool _flashOn = false;

  @override
  void initState() {
    super.initState();
    _state = widget.initialState;
    _errorMessage = widget.errorMessage;
  }

  void _onDetected(String rawValue) {
    if (_state != QrScannerState.scanning) return;

    setState(() => _state = QrScannerState.processing);

    // Validate it's an OHPP URI
    if (!rawValue.startsWith('ohpp://')) {
      setState(() {
        _state = QrScannerState.error;
        _errorMessage = 'Invalid QR code. Not an OHPP registration link.';
      });
      return;
    }

    widget.onResult(rawValue);
  }

  void _retry() {
    setState(() {
      _state = QrScannerState.scanning;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera or placeholder
          _buildCameraView(),

          // Frame overlay
          _buildFrameOverlay(),

          // Top bar
          _buildTopBar(context),

          // Bottom overlay for state indicators
          if (_state == QrScannerState.processing) _buildProcessingOverlay(),
          if (_state == QrScannerState.error) _buildErrorOverlay(),
        ],
      ),
    );
  }

  Widget _buildCameraView() {
    if (widget.testMode) {
      // Test placeholder
      return Container(
        key: const Key('scanner-viewfinder'),
        color: AppColors.slate900,
        child: const Center(
          child: Icon(
            Icons.camera_alt,
            color: AppColors.slate600,
            size: 64,
          ),
        ),
      );
    }

    // In real builds, this would be MobileScanner widget
    return Container(
      key: const Key('scanner-viewfinder'),
      color: Colors.black,
    );
  }

  Widget _buildFrameOverlay() {
    return Center(
      key: const Key('scanner-frame-overlay'),
      child: Container(
        width: 250,
        height: 250,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.indigo, width: 3),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              key: const Key('scanner-cancel'),
              onPressed: widget.onCancel ?? () => Navigator.maybePop(context),
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
            ),
            Text(
              'Scan QR Code',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            IconButton(
              key: const Key('scanner-flash-toggle'),
              onPressed: () {
                setState(() => _flashOn = !_flashOn);
              },
              icon: Icon(
                _flashOn ? Icons.flash_on : Icons.flash_off,
                color: Colors.white,
                size: 28,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProcessingOverlay() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        key: const Key('scanner-processing'),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.8),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.indigo),
            const SizedBox(height: 16),
            const Text(
              'Processing...',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Verifying registration challenge',
              style: TextStyle(color: AppColors.slate400, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorOverlay() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        key: const Key('scanner-error'),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.8),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.red, size: 40),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'An error occurred',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              key: const Key('scanner-retry'),
              onPressed: _retry,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
