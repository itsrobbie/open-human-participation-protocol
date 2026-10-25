import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';

/// Registered apps list with FAB for connecting new apps.
class AppsScreen extends ConsumerStatefulWidget {
  final void Function(String appId)? onQrScan;
  final void Function(String appId)? onPaste;

  const AppsScreen({super.key, this.onQrScan, this.onPaste});

  @override
  ConsumerState<AppsScreen> createState() => _AppsScreenState();
}

class _AppsScreenState extends ConsumerState<AppsScreen> {
  @override
  void initState() {
    super.initState();
    // Load the connected apps once the screen mounts (mirrors HistoryScreen).
    // Without this the Apps tab renders empty even when apps are connected.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(appsProvider.notifier).fetchApps();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Apps'),
        actions: [
          IconButton(
            key: const Key('apps-refresh'),
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(appsProvider.notifier).fetchApps(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        key: const Key('apps-fab'),
        onPressed: () => _showConnectOptions(context),
        child: const Icon(Icons.add),
      ),
      body: _buildBody(context, ref, state),
    );
  }

  Widget _buildBody(BuildContext context, WidgetRef ref, AppsState state) {
    if (state.isLoading && state.apps.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.apps.isEmpty) {
      return Center(
        key: const Key('apps-empty'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.apps_outlined, size: 64, color: AppColors.slate300),
            const SizedBox(height: 16),
            const Text(
              'No apps connected',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Connect an app to start receiving\nparticipation requests.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate500),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showConnectOptions(context),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Connect an app'),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      key: const Key('apps-list'),
      itemCount: state.apps.length,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemBuilder: (context, index) {
        final app = state.apps[index];
        return _AppCard(
          key: Key('app-card-$index'),
          app: app,
          onTap: () => _showAppDetail(context, ref, app),
        );
      },
    );
  }

  void _showConnectOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Connect an app',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              ListTile(
                key: const Key('connect-option-qr'),
                leading: const Icon(Icons.qr_code_scanner),
                title: const Text('Scan QR code'),
                subtitle: const Text('Scan a registration QR code'),
                onTap: () {
                  Navigator.pop(ctx);
                  widget.onQrScan?.call('');
                },
              ),
              ListTile(
                key: const Key('connect-option-paste'),
                leading: const Icon(Icons.content_paste),
                title: const Text('Paste link'),
                subtitle: const Text('Paste a registration link'),
                onTap: () {
                  Navigator.pop(ctx);
                  widget.onPaste?.call('');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAppDetail(BuildContext context, WidgetRef ref, Map<String, dynamic> app) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _AppDetailSheet(
        key: const Key('app-detail-sheet'),
        app: app,
        onToggleNotifications: (enabled) {
          final appId = app['appId'] as String? ?? '';
          if (appId.isNotEmpty) {
            ref.read(appsProvider.notifier).setNotificationPreference(appId, enabled);
          }
        },
        onRevoke: () async {
          Navigator.pop(ctx);
          final confirmed = await _showRevokeConfirmation(context);
          if (confirmed == true) {
            // Revoke by the REGISTRATION id (the GUID), which the resolver's
            // DELETE /api/registrations/apps/{id} expects — NOT app['appId']
            // (the app's string id like 'protocol-lab.dev.test'), which 404s so
            // the app is never actually revoked.
            final registrationId = (app['id'] ?? app['appId']) as String;
            ref.read(appsProvider.notifier).revokeApp(registrationId);
          }
        },
      ),
    );
  }

  Future<bool?> _showRevokeConfirmation(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('revoke-confirm-dialog'),
        title: const Text('Revoke access'),
        content: const Text(
          'This app will no longer be able to send you participation requests. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('revoke-confirm-yes'),
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  final Map<String, dynamic> app;
  final VoidCallback onTap;

  const _AppCard({super.key, required this.app, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final appId = app['appId'] as String? ?? '';
    final appName = app['appName'] as String? ?? appId;
    final registeredAt = app['registeredAt'] as String? ?? '';

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
                child: Text(
                  appId.isNotEmpty ? appId[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: AppColors.indigo,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      appName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      appId,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                _formatDate(registeredAt),
                style: const TextStyle(fontSize: 11, color: AppColors.slate400),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppColors.slate300),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(String isoString) {
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return '';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

class _AppDetailSheet extends StatefulWidget {
  final Map<String, dynamic> app;
  final VoidCallback onRevoke;
  final void Function(bool enabled)? onToggleNotifications;

  const _AppDetailSheet({
    super.key,
    required this.app,
    required this.onRevoke,
    this.onToggleNotifications,
  });

  @override
  State<_AppDetailSheet> createState() => _AppDetailSheetState();
}

class _AppDetailSheetState extends State<_AppDetailSheet> {
  late bool _pushEnabled;

  @override
  void initState() {
    super.initState();
    _pushEnabled = widget.app['pushEnabled'] as bool? ?? true;
  }

  @override
  Widget build(BuildContext context) {
    final appId = widget.app['appId'] as String? ?? '';
    final appName = widget.app['appName'] as String? ?? appId;
    final registeredAt = widget.app['registeredAt'] as String? ?? '';

    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.7,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
                    child: Text(
                      appId.isNotEmpty ? appId[0].toUpperCase() : '?',
                      style: const TextStyle(
                        color: AppColors.indigo,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          appId,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.slate500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Registered date
              _infoRow(Icons.calendar_today, 'Connected', _formatDate(registeredAt)),
              const SizedBox(height: 16),

              // Notifications toggle
              Row(
                children: [
                  const Icon(Icons.notifications_outlined, size: 20, color: AppColors.slate500),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text('Push notifications', style: TextStyle(fontSize: 15)),
                  ),
                  Switch(
                    key: const Key('app-notification-toggle'),
                    value: _pushEnabled,
                    onChanged: (val) {
                      setState(() => _pushEnabled = val);
                      widget.onToggleNotifications?.call(val);
                    },
                  ),
                ],
              ),
              const Divider(height: 32),

              // Revoke button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: const Key('app-revoke-button'),
                  onPressed: widget.onRevoke,
                  icon: const Icon(Icons.link_off, color: AppColors.red),
                  label: const Text('Revoke access'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.red,
                    side: const BorderSide(color: AppColors.red),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.slate500),
        const SizedBox(width: 12),
        Text(
          '$label: ',
          style: const TextStyle(fontSize: 14, color: AppColors.slate500),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  String _formatDate(String isoString) {
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return isoString;
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
