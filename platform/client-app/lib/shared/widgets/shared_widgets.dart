import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Urgency badge showing time remaining before expiry.
class UrgencyBadge extends StatelessWidget {
  final DateTime? expiry;

  const UrgencyBadge({super.key, required this.expiry});

  @override
  Widget build(BuildContext context) {
    if (expiry == null) return const SizedBox.shrink();

    final remaining = expiry!.difference(DateTime.now());

    String label;
    Color color;

    if (remaining.isNegative) {
      label = 'Expired';
      color = AppColors.slate400;
    } else if (remaining.inMinutes < 5) {
      label = '< 5m';
      color = AppColors.red;
    } else if (remaining.inMinutes < 15) {
      label = '< 15m';
      color = AppColors.amber;
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      key: const Key('urgency-badge'),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

/// Status badge for participation requests/history.
class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    switch (status) {
      case 'pending':
        color = AppColors.amber;
        label = 'Pending';
      case 'resolved':
        color = AppColors.emerald;
        label = 'Resolved';
      case 'expired':
        color = AppColors.slate400;
        label = 'Expired';
      case 'auto_responded':
        color = AppColors.emerald;
        label = 'Auto';
      case 'cancelled':
        color = AppColors.red;
        label = 'Cancelled';
      default:
        color = AppColors.slate400;
        label = status;
    }

    return Container(
      key: const Key('status-badge'),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

/// Type badge showing request type.
class TypeBadge extends StatelessWidget {
  final String type;

  const TypeBadge({super.key, required this.type});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('type-badge'),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        type,
        style: const TextStyle(fontSize: 11, color: AppColors.slate600),
      ),
    );
  }
}

/// Empty state placeholder widget.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      key: const Key('empty-state'),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: AppColors.slate300),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: const TextStyle(color: AppColors.slate500),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: 24),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Error state with retry button.
class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const ErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      key: const Key('error-state'),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppColors.red),
            const SizedBox(height: 16),
            const Text(
              'Something went wrong',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(color: AppColors.slate500),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Loading skeleton placeholder.
class LoadingSkeleton extends StatelessWidget {
  final int count;

  const LoadingSkeleton({super.key, this.count = 3});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      key: const Key('loading-skeleton'),
      itemCount: count,
      padding: const EdgeInsets.symmetric(vertical: 8),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemBuilder: (_, __) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: AppColors.slate200,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(width: 100, height: 12, color: AppColors.slate200),
                    const SizedBox(height: 8),
                    Container(width: double.infinity, height: 14, color: AppColors.slate200),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Offline indicator banner.
class OfflineIndicator extends StatelessWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('offline-indicator'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.amber.withValues(alpha: 0.15),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off, size: 16, color: AppColors.amber),
          const SizedBox(width: 8),
          const Text(
            'You are offline',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.amber,
            ),
          ),
        ],
      ),
    );
  }
}

/// Confirmation dialog with destructive action styling.
class ConfirmationDialog extends StatelessWidget {
  final String title;
  final String content;
  final String confirmLabel;
  final bool isDestructive;
  final VoidCallback onConfirm;

  const ConfirmationDialog({
    super.key,
    required this.title,
    required this.content,
    this.confirmLabel = 'Confirm',
    this.isDestructive = false,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      key: const Key('confirmation-dialog'),
      title: Text(title),
      content: Text(content),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
      key: const Key('ohpp.shared.text-action'),
          onPressed: () {
            Navigator.pop(context);
            onConfirm();
          },
          style: isDestructive
              ? TextButton.styleFrom(foregroundColor: AppColors.red)
              : null,
          child: Text(confirmLabel),
        ),
      ],
    );
  }
}
