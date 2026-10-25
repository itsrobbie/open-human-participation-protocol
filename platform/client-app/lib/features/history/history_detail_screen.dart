import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Full details of a historical participation entry.
class HistoryDetailScreen extends StatefulWidget {
  final Map<String, dynamic> entry;

  const HistoryDetailScreen({super.key, required this.entry});

  @override
  State<HistoryDetailScreen> createState() => _HistoryDetailScreenState();
}

class _HistoryDetailScreenState extends State<HistoryDetailScreen> {
  bool _attestationExpanded = false;

  Map<String, dynamic> get _entry => widget.entry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 20),
            _buildStatusSection(),
            if (_entry['description'] != null) ...[
              const SizedBox(height: 20),
              _buildSection('Description', _entry['description'] as String),
            ],
            const SizedBox(height: 20),
            _buildResponseSection(),
            if (_entry['ruleName'] != null) ...[
              const SizedBox(height: 20),
              _buildRuleSection(),
            ],
            if (_entry['transactionId'] != null) ...[
              const SizedBox(height: 20),
              _buildTransactionSection(),
            ],
            const SizedBox(height: 20),
            _buildMetadataSection(),
            if (_entry['attestationPayload'] != null) ...[
              const SizedBox(height: 20),
              _buildAttestationSection(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final appId = _entry['appId'] as String? ?? '';
    final appName = _entry['appName'] as String? ?? appId;
    final summary = _entry['summary'] as String? ?? '';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
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
                  fontSize: 14,
                  color: AppColors.slate500,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                summary,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusSection() {
    final status = _entry['status'] as String? ?? 'resolved';
    final resolvedAt = _entry['resolvedAt'] as String?;

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'resolved':
        statusColor = AppColors.emerald;
        statusLabel = 'Resolved';
      case 'expired':
        statusColor = AppColors.slate400;
        statusLabel = 'Expired';
      case 'cancelled':
        statusColor = AppColors.red;
        statusLabel = 'Cancelled';
      default:
        statusColor = AppColors.amber;
        statusLabel = status;
    }

    return Row(
      children: [
        Container(
          key: const Key('detail-status-badge'),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            statusLabel,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: statusColor,
            ),
          ),
        ),
        if (resolvedAt != null) ...[
          const SizedBox(width: 12),
          Text(
            _formatDateTime(resolvedAt),
            style: const TextStyle(fontSize: 13, color: AppColors.slate500),
          ),
        ],
      ],
    );
  }

  Widget _buildSection(String title, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(content, style: const TextStyle(fontSize: 15)),
      ],
    );
  }

  Widget _buildResponseSection() {
    final decision = _entry['decision'] as String? ?? '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.indigo.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.indigo.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'YOUR RESPONSE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.slate400,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            decision,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.indigo,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRuleSection() {
    final ruleName = _entry['ruleName'] as String;

    return Container(
      key: const Key('detail-rule-info'),
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.emerald.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.emerald.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, size: 18, color: AppColors.emerald),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Auto-responded by rule',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.slate500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  ruleName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.emerald,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionSection() {
    final label = _entry['transactionLabel'] as String? ?? _entry['transactionId'] as String;

    return Container(
      key: const Key('detail-transaction'),
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Row(
        children: [
          const Icon(Icons.link, size: 18, color: AppColors.slate500),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Transaction',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.slate500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataSection() {
    final timestamp = _entry['timestamp'] as String? ?? '';
    final deviceName = _entry['deviceName'] as String? ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'DETAILS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        _metadataRow(Icons.access_time, 'Received', _formatDateTime(timestamp)),
        const SizedBox(height: 8),
        _metadataRow(Icons.phone_iphone, 'Device', deviceName),
      ],
    );
  }

  Widget _metadataRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.slate400),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(fontSize: 13, color: AppColors.slate500),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  Widget _buildAttestationSection() {
    final payload = _entry['attestationPayload'] as String;
    final signature = _entry['deviceSignature'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          key: const Key('detail-attestation-toggle'),
          onTap: () => setState(() => _attestationExpanded = !_attestationExpanded),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.security, size: 16, color: AppColors.slate500),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Attestation details',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.slate600,
                    ),
                  ),
                ),
                Icon(
                  _attestationExpanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  size: 20,
                  color: AppColors.slate400,
                ),
              ],
            ),
          ),
        ),
        if (_attestationExpanded) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.slate50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PAYLOAD',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.slate400,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  payload,
                  key: const Key('detail-attestation-payload'),
                  style: const TextStyle(
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
                if (signature != null) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'SIGNATURE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.slate400,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    signature,
                    style: const TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  String _formatDateTime(String isoString) {
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return isoString;
    final local = dt.toLocal();
    return '${local.day}/${local.month}/${local.year} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}
