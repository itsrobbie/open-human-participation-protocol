import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

/// Reorderable list of participation rules with enable/disable toggles.
class RulesScreen extends ConsumerStatefulWidget {
  final VoidCallback? onCreateTap;
  final void Function(Map<String, dynamic> rule)? onEditTap;

  const RulesScreen({super.key, this.onCreateTap, this.onEditTap});

  @override
  ConsumerState<RulesScreen> createState() => _RulesScreenState();
}

class _RulesScreenState extends ConsumerState<RulesScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(rulesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Rules')),
      floatingActionButton: FloatingActionButton(
        key: const Key('rules-fab'),
        onPressed: widget.onCreateTap,
        child: const Icon(Icons.add),
      ),
      body: state.rules.isEmpty ? _buildEmpty() : _buildList(state),
    );
  }

  Widget _buildEmpty() {
    return Center(
      key: const Key('rules-empty'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.auto_awesome_outlined, size: 64, color: AppColors.slate300),
          const SizedBox(height: 16),
          const Text(
            'No rules yet',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          const Text(
            'Create rules to auto-respond to\nparticipation requests.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate500),
          ),
        ],
      ),
    );
  }

  Widget _buildList(RulesState state) {
    return ReorderableListView.builder(
      key: const Key('rules-list'),
      itemCount: state.rules.length,
      padding: const EdgeInsets.symmetric(vertical: 8),
      onReorder: (oldIndex, newIndex) {
        // Reorder logic - update priorities
        if (newIndex > oldIndex) newIndex--;
        final rules = List<Map<String, dynamic>>.from(state.rules);
        final item = rules.removeAt(oldIndex);
        rules.insert(newIndex, item);
        // Update state (in real app, also sync to server)
      },
      itemBuilder: (context, index) {
        final rule = state.rules[index];
        return _RuleCard(
          key: Key('rule-card-$index'),
          rule: rule,
          index: index,
          onToggle: () => _toggleRule(index),
          onDelete: () => _confirmDelete(rule),
          onTap: widget.onEditTap != null
              ? () => widget.onEditTap!(rule)
              : null,
        );
      },
    );
  }

  void _toggleRule(int index) {
    final rules = List<Map<String, dynamic>>.from(ref.read(rulesProvider).rules);
    rules[index] = Map<String, dynamic>.from(rules[index]);
    rules[index]['enabled'] = !(rules[index]['enabled'] as bool? ?? true);
    // Update state directly for UI responsiveness
    ref.read(rulesProvider.notifier).setRules(rules);
  }

  void _confirmDelete(Map<String, dynamic> rule) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('rule-delete-confirm'),
        title: const Text('Delete rule?'),
        content: Text('Are you sure you want to delete "${rule['name']}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(rulesProvider.notifier).delete(rule['id'] as String);
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _RuleCard extends StatelessWidget {
  final Map<String, dynamic> rule;
  final int index;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  final VoidCallback? onTap;

  const _RuleCard({
    super.key,
    required this.rule,
    required this.index,
    required this.onToggle,
    required this.onDelete,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = rule['name'] as String? ?? 'Unnamed rule';
    final enabled = rule['enabled'] as bool? ?? true;
    final priority = rule['priority'] as int? ?? index + 1;

    return Dismissible(
      key: Key('rule-dismiss-${rule['id']}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onDelete();
        return false; // Dialog handles actual deletion
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        color: AppColors.red,
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Icon(
                Icons.drag_handle,
                color: AppColors.slate300,
                size: 20,
              ),
              const SizedBox(width: 12),
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.indigo.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$priority',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.indigo,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: enabled ? null : AppColors.slate400,
                    decoration: enabled ? null : TextDecoration.lineThrough,
                  ),
                ),
              ),
              Switch(
                key: Key('rule-toggle-$index'),
                value: enabled,
                onChanged: (_) => onToggle(),
              ),
              IconButton(
                key: Key('rule-delete-$index'),
                icon: const Icon(Icons.delete_outline, size: 20),
                color: AppColors.slate400,
                onPressed: onDelete,
              ),
            ],
          ),
        ),
        ),
      ),
    );
  }
}
