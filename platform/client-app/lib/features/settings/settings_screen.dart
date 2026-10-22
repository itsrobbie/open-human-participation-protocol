import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Settings hub with list tiles for subsections.
class SettingsScreen extends StatelessWidget {
  final void Function(String route)? onNavigate;

  const SettingsScreen({super.key, this.onNavigate});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          _buildSection(context, 'Preferences', [
            _SettingsTile(
              icon: Icons.palette_outlined,
              title: 'Appearance',
              subtitle: 'Theme, text size',
              onTap: () => onNavigate?.call('appearance'),
            ),
            _SettingsTile(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              subtitle: 'Push preferences per app',
              onTap: () => onNavigate?.call('notifications'),
            ),
            _SettingsTile(
              icon: Icons.auto_awesome_outlined,
              title: 'Rules',
              subtitle: 'Auto-respond rules',
              onTap: () => onNavigate?.call('rules'),
            ),
          ]),
          const SizedBox(height: 8),
          _buildSection(context, 'Security', [
            _SettingsTile(
              icon: Icons.security_outlined,
              title: 'Security',
              subtitle: 'Keys, device security',
              onTap: () => onNavigate?.call('security'),
            ),
          ]),
          const SizedBox(height: 8),
          _buildSection(context, 'Developer', [
            _SettingsTile(
              icon: Icons.bug_report_outlined,
              title: 'Developer',
              subtitle: 'Diagnostic logs, verbose logging',
              onTap: () => onNavigate?.call('developer'),
            ),
          ]),
          const SizedBox(height: 8),
          _buildSection(context, 'Data', [
            _SettingsTile(
              icon: Icons.download_outlined,
              title: 'Export data',
              subtitle: 'Download your participation history',
              onTap: () => onNavigate?.call('export'),
            ),
            _SettingsTile(
              icon: Icons.delete_outline,
              title: 'Delete account',
              subtitle: 'Permanently delete your account and data',
              isDestructive: true,
              onTap: () => _showDeleteConfirmation(context),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _buildSection(BuildContext context, String title, List<Widget> tiles) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.slate400,
              letterSpacing: 0.8,
            ),
          ),
        ),
        ...tiles,
      ],
    );
  }

  void _showDeleteConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('delete-account-dialog'),
        title: const Text('Delete your account?'),
        content: const Text(
          'This will permanently delete your account, all devices, and participation history. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            key: const Key('ohpp.settings.dialog-cancel'),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('ohpp.settings.dialog-confirm'),
            onPressed: () {
              Navigator.pop(ctx);
              onNavigate?.call('delete-account');
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool isDestructive;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDestructive ? AppColors.red : null;

    return ListTile(
      leading: Icon(icon, color: color ?? AppColors.slate600),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 13,
          color: isDestructive ? AppColors.red.withValues(alpha: 0.7) : AppColors.slate500,
        ),
      ),
      trailing: Icon(Icons.chevron_right, color: AppColors.slate300),
      onTap: onTap,
    );
  }
}
