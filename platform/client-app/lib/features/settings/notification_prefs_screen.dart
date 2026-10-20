import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Per-app notification preference toggles.
class NotificationPrefsScreen extends StatefulWidget {
  final List<Map<String, dynamic>> prefs;

  const NotificationPrefsScreen({super.key, required this.prefs});

  @override
  State<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends State<NotificationPrefsScreen> {
  late List<Map<String, dynamic>> _prefs;

  @override
  void initState() {
    super.initState();
    _prefs = widget.prefs.map((p) => Map<String, dynamic>.from(p)).toList();
  }

  void _togglePush(int index) {
    setState(() {
      _prefs[index]['pushEnabled'] = !(_prefs[index]['pushEnabled'] as bool);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: _prefs.isEmpty
          ? const Center(
              child: Text(
                'No apps registered yet.',
                style: TextStyle(color: AppColors.slate500),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _prefs.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final pref = _prefs[index];
                return _AppNotifTile(
                  index: index,
                  appName: pref['appName'] as String? ?? pref['appId'] as String,
                  appId: pref['appId'] as String,
                  pushEnabled: pref['pushEnabled'] as bool? ?? true,
                  onTogglePush: () => _togglePush(index),
                );
              },
            ),
    );
  }
}

class _AppNotifTile extends StatelessWidget {
  final int index;
  final String appName;
  final String appId;
  final bool pushEnabled;
  final VoidCallback onTogglePush;

  const _AppNotifTile({
    required this.index,
    required this.appName,
    required this.appId,
    required this.pushEnabled,
    required this.onTogglePush,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
            child: Text(
              appId.isNotEmpty ? appId[0].toUpperCase() : '?',
              style: const TextStyle(
                color: AppColors.indigo,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(appName, style: const TextStyle(fontWeight: FontWeight.w500)),
                Text(
                  appId,
                  style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                ),
              ],
            ),
          ),
          Switch(
            key: Key('notif-push-toggle-$index'),
            value: pushEnabled,
            onChanged: (_) => onTogglePush(),
          ),
        ],
      ),
    );
  }
}
