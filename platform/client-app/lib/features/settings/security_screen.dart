import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Security settings: key info, rotation, device security status.
class SecurityScreen extends StatelessWidget {
  final String keyAlgorithm;
  final String storageLevel;
  final bool jailbroken;

  const SecurityScreen({
    super.key,
    required this.keyAlgorithm,
    required this.storageLevel,
    this.jailbroken = false,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Security')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          if (jailbroken) _buildJailbreakWarning(),
          _buildKeyInfoSection(),
          const SizedBox(height: 24),
          _buildRotateKeyButton(context),
          const SizedBox(height: 32),
          _buildDeviceSecuritySection(),
        ],
      ),
    );
  }

  Widget _buildJailbreakWarning() {
    return Container(
      key: const Key('security-jailbreak-warning'),
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.red.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.red.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber, color: AppColors.red, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Compromised device detected',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.red,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'This device appears to be jailbroken or rooted. Key security may be reduced.',
                  style: TextStyle(fontSize: 13, color: AppColors.red),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKeyInfoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SIGNING KEY',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        _infoRow(Icons.key, 'Algorithm', keyAlgorithm),
        const SizedBox(height: 10),
        _infoRow(Icons.shield_outlined, 'Storage', storageLevel),
      ],
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.slate500),
          const SizedBox(width: 12),
          Text(
            '$label: ',
            style: const TextStyle(fontSize: 14, color: AppColors.slate500),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildRotateKeyButton(BuildContext context) {
    return OutlinedButton.icon(
      key: const Key('security-rotate-key'),
      onPressed: () => _showRotateDialog(context),
      icon: const Icon(Icons.refresh),
      label: const Text('Rotate signing key'),
    );
  }

  Widget _buildDeviceSecuritySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'DEVICE SECURITY',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        _statusRow(
          'Device integrity',
          jailbroken ? 'Compromised' : 'Verified',
          jailbroken ? AppColors.red : AppColors.emerald,
        ),
        const SizedBox(height: 8),
        _statusRow(
          'Hardware-backed keys',
          storageLevel.contains('Enclave') || storageLevel.contains('Keystore')
              ? 'Available'
              : 'Not available',
          storageLevel.contains('Enclave') || storageLevel.contains('Keystore')
              ? AppColors.emerald
              : AppColors.amber,
        ),
      ],
    );
  }

  Widget _statusRow(String label, String status, Color statusColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 14)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: statusColor,
            ),
          ),
        ),
      ],
    );
  }

  void _showRotateDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('rotate-key-dialog'),
        title: const Text('Rotate signing key?'),
        content: const Text(
          'A new key pair will be generated and registered with the Resolver. '
          'The old key will be invalidated. All connected apps will be notified.',
        ),
        actions: [
          TextButton(
              key: const Key('ohpp.security.dialog-cancel'),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
              key: const Key('ohpp.security.dialog-confirm'),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Rotate'),
          ),
        ],
      ),
    );
  }
}
