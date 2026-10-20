import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// User profile screen with identity info and device list.
class ProfileScreen extends StatelessWidget {
  final Map<String, dynamic> user;
  final List<Map<String, dynamic>> devices;

  /// Navigate to Settings. When provided, a settings action is shown in the
  /// app bar (the primary, discoverable entry point to Settings).
  final VoidCallback? onOpenSettings;

  const ProfileScreen({
    super.key,
    required this.user,
    required this.devices,
    this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (onOpenSettings != null)
            IconButton(
              key: const Key('profile-settings-button'),
              icon: const Icon(Icons.settings_outlined),
              tooltip: 'Settings',
              onPressed: onOpenSettings,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildUserSection(),
            const SizedBox(height: 32),
            _buildDevicesSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildUserSection() {
    final username = user['username'] as String? ?? '';
    final email = user['email'] as String? ?? '';
    final resolverUrl = user['resolverUrl'] as String? ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: CircleAvatar(
            radius: 40,
            backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
            child: Text(
              username.isNotEmpty ? username[0].toUpperCase() : '?',
              style: const TextStyle(
                color: AppColors.indigo,
                fontWeight: FontWeight.bold,
                fontSize: 28,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            username,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
        ),
        if (email.isNotEmpty) ...[
          const SizedBox(height: 4),
          Center(
            child: Text(
              email,
              style: const TextStyle(fontSize: 14, color: AppColors.slate500),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.slate50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.slate200),
          ),
          child: Row(
            children: [
              const Icon(Icons.dns_outlined, size: 18, color: AppColors.slate500),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  resolverUrl,
                  style: const TextStyle(fontSize: 13, color: AppColors.slate600),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDevicesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'DEVICES',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        ...devices.map((device) => _DeviceCard(device: device)),
      ],
    );
  }
}

class _DeviceCard extends StatelessWidget {
  final Map<String, dynamic> device;

  const _DeviceCard({required this.device});

  @override
  Widget build(BuildContext context) {
    final name = device['name'] as String? ?? 'Unknown device';
    final keyLevel = device['keyLevel'] as String? ?? 'software';
    final isCurrent = device['isCurrent'] as bool? ?? false;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(
              Icons.phone_iphone,
              color: isCurrent ? AppColors.indigo : AppColors.slate400,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (isCurrent) ...[
                        const SizedBox(width: 8),
                        Container(
                          key: const Key('device-current-badge'),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.indigo.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'This device',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppColors.indigo,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.key, size: 12, color: AppColors.emerald),
                      const SizedBox(width: 4),
                      Text(
                        _formatKeyLevel(keyLevel),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatKeyLevel(String level) {
    switch (level) {
      case 'secureEnclave':
        return 'Secure Enclave';
      case 'hardwareKeystore':
        return 'Hardware Keystore';
      default:
        return 'Software';
    }
  }
}
