import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/observability/dev_logger.dart';
import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/developer_settings_provider.dart';

/// Developer settings: toggle diagnostic logging and view captured logs.
class DeveloperScreen extends ConsumerWidget {
  const DeveloperScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dev = ref.watch(developerSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Developer')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'DIAGNOSTIC LOGS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.slate400,
                letterSpacing: 0.8,
              ),
            ),
          ),
          SwitchListTile(
            key: const Key('dev-logging-toggle'),
            secondary: const Icon(Icons.bug_report_outlined),
            title: const Text('Enable developer logs'),
            subtitle: const Text(
              'Capture verbose request/response and I/O logs in memory. '
              'Sensitive values (tokens, passwords) are redacted.',
            ),
            value: dev.loggingEnabled,
            onChanged: (v) =>
                ref.read(developerSettingsProvider.notifier).setLoggingEnabled(v),
          ),
          const Divider(),
          ListTile(
            key: const Key('dev-view-logs'),
            leading: const Icon(Icons.article_outlined),
            title: const Text('View diagnostic logs'),
            subtitle: Text(dev.loggingEnabled
                ? 'Live capture is ON'
                : 'Turn logging on to capture new entries'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const DiagnosticLogsScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

/// Live-updating viewer for the in-memory [DevLog] buffer.
class DiagnosticLogsScreen extends StatelessWidget {
  const DiagnosticLogsScreen({super.key});

  Color _levelColor(DevLogLevel level) {
    switch (level) {
      case DevLogLevel.error:
        return AppColors.red;
      case DevLogLevel.warning:
        return Colors.orange;
      case DevLogLevel.info:
        return AppColors.slate600;
      case DevLogLevel.debug:
        return AppColors.slate400;
    }
  }

  @override
  Widget build(BuildContext context) {
    final devLog = DevLog.instance;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Diagnostic Logs'),
        actions: [
          IconButton(
            key: const Key('dev-logs-copy'),
            tooltip: 'Copy all',
            icon: const Icon(Icons.copy_all),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: devLog.exportText()));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Logs copied to clipboard')),
                );
              }
            },
          ),
          IconButton(
            key: const Key('dev-logs-clear'),
            tooltip: 'Clear',
            icon: const Icon(Icons.delete_outline),
            onPressed: devLog.clear,
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: devLog,
        builder: (context, _) {
          final entries = devLog.entries;
          if (entries.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  devLog.enabled
                      ? 'No logs captured yet. Reproduce the issue and pull down to refresh.'
                      : 'Logging is OFF. Enable it in Developer settings, then reproduce the issue.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.slate500),
                ),
              ),
            );
          }
          // Newest first for readability.
          final ordered = entries.reversed.toList();
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: ordered.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final e = ordered[i];
              return ListTile(
                dense: true,
                title: Text(
                  '[${e.tag}] ${e.message}',
                  style: TextStyle(
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: _levelColor(e.level),
                    fontWeight: e.level == DevLogLevel.error
                        ? FontWeight.w600
                        : FontWeight.normal,
                  ),
                ),
                subtitle: Text(
                  '${e.level.label}  ${e.timestamp.toIso8601String()}'
                  '${e.detail != null ? '\n${e.detail}' : ''}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: AppColors.slate500,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
