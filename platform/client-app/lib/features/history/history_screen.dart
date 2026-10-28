import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';

/// Paginated history list with search and filter.
class HistoryScreen extends ConsumerStatefulWidget {
  final void Function(Map<String, dynamic> entry)? onEntryTap;

  const HistoryScreen({super.key, this.onEntryTap});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  bool _isSearching = false;
  String? _statusFilter;
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _searchController.addListener(_onSearchChanged);
    // Load (or refresh) the first page when the screen is shown. Nothing else
    // triggers the initial fetch, so without this History renders empty until a
    // scroll-driven loadMore. Post-frame so we don't mutate a provider in build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(historyProvider.notifier).fetchFirstPage();
    });
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {});
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 100) {
      // Near bottom - trigger load more if needed
      final state = ref.read(historyProvider);
      if (state.hasMore && !state.isLoading) {
        ref.read(historyProvider.notifier).loadMore();
      }
    }
  }

  List<Map<String, dynamic>> _filterEntries(List<Map<String, dynamic>> entries) {
    var result = entries;

    final query = _searchController.text.toLowerCase();
    if (query.isNotEmpty) {
      result = result.where((e) {
        final summary = (e['summary'] as String? ?? '').toLowerCase();
        final appId = (e['appId'] as String? ?? '').toLowerCase();
        return summary.contains(query) || appId.contains(query);
      }).toList();
    }

    if (_statusFilter != null) {
      result = result.where((e) => e['status'] == _statusFilter).toList();
    }

    return result;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(historyProvider);

    return Scaffold(
      appBar: AppBar(
        title: _isSearching
            ? TextField(
                key: const Key('history-search-field'),
                controller: _searchController,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Search history...',
                  border: InputBorder.none,
                ),
                onChanged: (_) => setState(() {}),
              )
            : const Text('History'),
        actions: [
          IconButton(
            key: const Key('history-search-toggle'),
            icon: Icon(_isSearching ? Icons.close : Icons.search),
            onPressed: () {
              setState(() {
                _isSearching = !_isSearching;
                if (!_isSearching) {
                  _searchController.clear();
                }
              });
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterChips(),
          Expanded(child: _buildBody(state)),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _FilterChip(
            key: const Key('history-filter-all'),
            label: 'All',
            selected: _statusFilter == null,
            onSelected: () => setState(() => _statusFilter = null),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            key: const Key('history-filter-resolved'),
            label: 'Resolved',
            selected: _statusFilter == 'resolved',
            onSelected: () => setState(() => _statusFilter = 'resolved'),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            key: const Key('history-filter-expired'),
            label: 'Expired',
            selected: _statusFilter == 'expired',
            onSelected: () => setState(() => _statusFilter = 'expired'),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            key: const Key('history-filter-auto'),
            label: 'Auto-responded',
            selected: _statusFilter == 'auto',
            onSelected: () => setState(() => _statusFilter = 'auto'),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(HistoryState state) {
    if (state.isLoading && state.entries.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.entries.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.red),
            const SizedBox(height: 12),
            Text(state.error!, style: const TextStyle(color: AppColors.slate500)),
          ],
        ),
      );
    }

    final entries = _filterEntries(state.entries);

    if (entries.isEmpty) {
      return Center(
        key: const Key('history-empty'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history, size: 64, color: AppColors.slate300),
            const SizedBox(height: 16),
            const Text(
              'No history yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your participation history will appear here.',
              style: TextStyle(color: AppColors.slate500),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      key: const Key('history-list'),
      controller: _scrollController,
      itemCount: entries.length + (state.hasMore ? 1 : 0),
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemBuilder: (context, index) {
        if (index >= entries.length) {
          return Padding(
            key: const Key('history-load-more'),
            padding: const EdgeInsets.all(16),
            child: const Center(child: CircularProgressIndicator()),
          );
        }

        final entry = entries[index];
        return _HistoryCard(
          key: Key('history-card-$index'),
          entry: entry,
          index: index,
          onTap: widget.onEntryTap != null
              ? () => widget.onEntryTap!(entry)
              : null,
        );
      },
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final int index;
  final VoidCallback? onTap;

  const _HistoryCard({
    super.key,
    required this.entry,
    required this.index,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final appId = entry['appId'] as String? ?? '';
    final summary = entry['summary'] as String? ?? '';
    final status = entry['status'] as String? ?? 'resolved';
    final ruleName = entry['ruleName'] as String?;
    final timestamp = entry['timestamp'] as String? ?? '';
    final deviceName = entry['deviceName'] as String?;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
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
                        Text(
                          appId,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.slate500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          summary,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _StatusBadge(status: status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (ruleName != null) ...[
                    Container(
                      key: Key('history-rule-badge-$index'),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.emerald.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.auto_awesome, size: 12, color: AppColors.emerald),
                          const SizedBox(width: 4),
                          Text(
                            ruleName,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.emerald,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (deviceName != null) ...[
                    Icon(Icons.phone_iphone, size: 12, color: AppColors.slate400),
                    const SizedBox(width: 4),
                    Text(
                      deviceName,
                      style: const TextStyle(fontSize: 11, color: AppColors.slate400),
                    ),
                    const SizedBox(width: 8),
                  ],
                  const Spacer(),
                  Text(
                    _formatTimestamp(timestamp),
                    style: const TextStyle(fontSize: 11, color: AppColors.slate400),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTimestamp(String timestamp) {
    final dt = DateTime.tryParse(timestamp);
    if (dt == null) return timestamp;
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    switch (status) {
      case 'resolved':
        color = AppColors.emerald;
        label = 'Resolved';
      case 'expired':
        color = AppColors.slate400;
        label = 'Expired';
      case 'cancelled':
        color = AppColors.red;
        label = 'Cancelled';
      case 'auto':
        color = AppColors.emerald;
        label = 'Auto';
      default:
        color = AppColors.amber;
        label = status;
    }

    return Container(
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

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onSelected;

  const _FilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      selectedColor: AppColors.indigo.withValues(alpha: 0.1),
      checkmarkColor: AppColors.indigo,
    );
  }
}
