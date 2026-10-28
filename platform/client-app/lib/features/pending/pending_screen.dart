import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/features/pending/request_detail_sheet.dart';
import 'package:ohpp_client/shared/models/attestation.dart';
import 'package:ohpp_client/shared/models/participation_request.dart';
import 'package:ohpp_client/shared/providers/attestation_service_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

/// Pending participation requests screen (Tab 1).
class PendingScreen extends ConsumerWidget {
  const PendingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(pendingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pending'),
        actions: [
          if (state.offlineQueueCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Badge(
                key: const Key('pending-queue-badge'),
                label: Text('${state.offlineQueueCount}'),
                child: const Icon(Icons.cloud_upload_outlined),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        key: const Key('pending-refresh'),
        onRefresh: () => ref.read(pendingProvider.notifier).refresh(),
        child: _buildBody(context, ref, state),
      ),
    );
  }

  Widget _buildBody(BuildContext context, WidgetRef ref, PendingState state) {
    if (state.isLoading && state.requests.isEmpty) {
      return const _LoadingSkeleton();
    }

    if (state.error != null && state.requests.isEmpty) {
      return _ErrorState(error: state.error!);
    }

    if (state.requests.isEmpty) {
      return const _EmptyState();
    }

    return ListView.builder(
      key: const Key('pending-list'),
      itemCount: state.requests.length,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemBuilder: (context, index) {
        final requestMap = state.requests[index];
        // P1: key by the stable requestId, not render order. In a multi-step
        // flow the list reorders as requests resolve, so an index-based key can
        // point at a different request between steps (the ambiguity that made
        // the headless ceremony drive flaky). Fall back to index only if a
        // request somehow lacks an id.
        final requestId = (requestMap['requestId'] ?? '').toString();
        final cardKey = requestId.isNotEmpty
            ? Key('ohpp.pending.card.$requestId')
            : Key('pending-card-$index');
        return _RequestCard(
          key: cardKey,
          request: requestMap,
          onTap: () => _openRequestDetail(context, ref, requestMap),
        );
      },
    );
  }

  void _openRequestDetail(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> requestMap,
  ) {
    final request = ParticipationRequest.fromJson(requestMap);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => RequestDetailSheet(
        request: request,
        onSubmit: (decision) {
          Navigator.of(context).pop(); // Close sheet
          _submitAttestation(context, ref, request, decision);
        },
      ),
    );
  }

  Future<void> _submitAttestation(
    BuildContext context,
    WidgetRef ref,
    ParticipationRequest request,
    AttestationDecision decision,
  ) async {
    AttestationService? service;
    try {
      service = ref.read(attestationServiceProvider);
    } catch (_) {
      // Provider not overridden (e.g. in tests) - no-op
      return;
    }

    final result = await service!.submit(request, decision);

    if (!context.mounted) return;

    if (result.success) {
      // Refresh the pending list to remove the resolved request
      ref.read(pendingProvider.notifier).refresh();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued
              ? 'Response queued for delivery'
              : 'Response submitted'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Submission failed'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.red,
        ),
      );
    }
  }
}

class _RequestCard extends StatelessWidget {
  final Map<String, dynamic> request;
  final VoidCallback onTap;

  const _RequestCard({super.key, required this.request, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final appId = request['appId'] as String? ?? '';
    final summary = request['summary'] as String? ?? '';
    final type = request['type'] as String? ?? 'select';
    final expiry = request['expiry'] as String?;
    final isUrgent = _isUrgent(expiry);

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
                child: Text(appId.isNotEmpty ? appId[0].toUpperCase() : '?',
                  style: const TextStyle(color: AppColors.indigo, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(appId, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(summary, style: const TextStyle(fontSize: 15)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _TypeBadge(type: type),
                  if (isUrgent) ...[
                    const SizedBox(height: 4),
                    Container(
                      key: const Key('urgent-badge'),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _isNearExpiry(expiry) ? AppColors.red.withValues(alpha: 0.1) : AppColors.amber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        _isNearExpiry(expiry) ? '< 5m' : '< 15m',
                        style: TextStyle(
                          fontSize: 11,
                          color: _isNearExpiry(expiry) ? AppColors.red : AppColors.amber,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _isUrgent(String? expiry) {
    if (expiry == null) return false;
    final exp = DateTime.tryParse(expiry);
    if (exp == null) return false;
    return exp.difference(DateTime.now()).inMinutes < 15;
  }

  bool _isNearExpiry(String? expiry) {
    if (expiry == null) return false;
    final exp = DateTime.tryParse(expiry);
    if (exp == null) return false;
    return exp.difference(DateTime.now()).inMinutes < 5;
  }
}

class _TypeBadge extends StatelessWidget {
  final String type;
  const _TypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(type, style: const TextStyle(fontSize: 11, color: AppColors.slate600)),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      key: const Key('pending-skeleton'),
      itemCount: 3,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemBuilder: (_, __) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.slate200, shape: BoxShape.circle)),
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

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      key: const Key('pending-empty'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle_outline, size: 64, color: AppColors.emerald.withValues(alpha: 0.5)),
          const SizedBox(height: 16),
          const Text('All clear', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const Text('No requests waiting for you.', style: TextStyle(color: AppColors.slate500)),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String error;
  const _ErrorState({required this.error});

  @override
  Widget build(BuildContext context) {
    return Center(
      key: const Key('pending-error'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: AppColors.red),
          const SizedBox(height: 16),
          const Text('Something went wrong', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(error, style: const TextStyle(color: AppColors.slate500), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            key: const Key('pending-retry'),
            onPressed: () {},
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
