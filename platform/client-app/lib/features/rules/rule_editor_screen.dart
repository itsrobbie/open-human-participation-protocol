import 'package:flutter/material.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Rule editor for creating/editing participation rules with conditions.
class RuleEditorScreen extends StatefulWidget {
  final Map<String, dynamic>? existingRule;
  final void Function(Map<String, dynamic> rule) onSave;

  const RuleEditorScreen({
    super.key,
    this.existingRule,
    required this.onSave,
  });

  @override
  State<RuleEditorScreen> createState() => _RuleEditorScreenState();
}

class _RuleEditorScreenState extends State<RuleEditorScreen> {
  late TextEditingController _nameController;
  String _authLevel = 'biometric';
  bool _autoRespond = false;
  List<Map<String, dynamic>> _conditions = [];
  String? _nameError;

  @override
  void initState() {
    super.initState();
    final rule = widget.existingRule;
    _nameController = TextEditingController(text: rule?['name'] as String? ?? '');
    _authLevel = rule?['authLevel'] as String? ?? 'biometric';
    _autoRespond = rule?['autoRespond'] as bool? ?? false;
    _conditions = (rule?['conditions'] as List?)
            ?.map((c) => Map<String, dynamic>.from(c as Map))
            .toList() ??
        [];
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _save() {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _nameError = 'Name is required');
      return;
    }
    setState(() => _nameError = null);

    widget.onSave({
      if (widget.existingRule?['id'] != null) 'id': widget.existingRule!['id'],
      'name': _nameController.text.trim(),
      'authLevel': _authLevel,
      'autoRespond': _autoRespond,
      'conditions': _conditions,
    });
  }

  void _addCondition() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ConditionEditorSheet(
        onSave: (condition) {
          setState(() => _conditions.add(condition));
          Navigator.pop(ctx);
        },
      ),
    );
  }

  void _removeCondition(int index) {
    setState(() => _conditions.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existingRule != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Rule' : 'New Rule'),
        actions: [
          TextButton(
            key: const Key('rule-save-button'),
            onPressed: _save,
            child: const Text('Save'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildNameField(),
            const SizedBox(height: 24),
            _buildConditionsSection(),
            const SizedBox(height: 24),
            _buildAuthLevelSection(),
            const SizedBox(height: 24),
            _buildAutoRespondSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildNameField() {
    return TextField(
      key: const Key('rule-name-field'),
      controller: _nameController,
      decoration: InputDecoration(
        labelText: 'Rule name',
        hintText: 'e.g. Low value orders',
        errorText: _nameError,
      ),
      onChanged: (_) {
        if (_nameError != null) setState(() => _nameError = null);
      },
    );
  }

  Widget _buildConditionsSection() {
    return Column(
      key: const Key('rule-conditions-list'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'CONDITIONS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.slate400,
                letterSpacing: 0.8,
              ),
            ),
            TextButton.icon(
              key: const Key('rule-add-condition'),
              onPressed: _addCondition,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),
        if (_conditions.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.slate50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.slate200),
            ),
            child: const Text(
              'No conditions. Rule matches all requests.',
              style: TextStyle(color: AppColors.slate500, fontSize: 13),
            ),
          )
        else
          ...List.generate(_conditions.length, (i) {
            final c = _conditions[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                dense: true,
                title: Text(
                  '${c['field']} ${c['operator']} "${c['value']}"',
                  style: const TextStyle(fontSize: 14),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => _removeCondition(i),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _buildAuthLevelSection() {
    return Column(
      key: const Key('rule-auth-level'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'AUTHENTICATION LEVEL',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate400,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'none', label: Text('None')),
            ButtonSegment(value: 'devicePasscode', label: Text('Passcode')),
            ButtonSegment(value: 'biometric', label: Text('Biometric')),
          ],
          selected: {_authLevel},
          onSelectionChanged: (sel) => setState(() => _authLevel = sel.first),
        ),
      ],
    );
  }

  Widget _buildAutoRespondSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'AUTO-RESPOND',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.slate400,
                letterSpacing: 0.8,
              ),
            ),
            Switch(
              key: const Key('rule-auto-respond-toggle'),
              value: _autoRespond,
              onChanged: (val) => setState(() => _autoRespond = val),
            ),
          ],
        ),
        if (_autoRespond)
          Container(
            key: const Key('rule-auto-respond-config'),
            width: double.infinity,
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.emerald.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.emerald.withValues(alpha: 0.2)),
            ),
            child: const Text(
              'When this rule matches, the request will be automatically approved without user interaction.',
              style: TextStyle(fontSize: 13, color: AppColors.slate600),
            ),
          ),
      ],
    );
  }
}

/// Bottom sheet for adding/editing a single rule condition.
class _ConditionEditorSheet extends StatefulWidget {
  final void Function(Map<String, dynamic> condition) onSave;

  const _ConditionEditorSheet({required this.onSave});

  @override
  State<_ConditionEditorSheet> createState() => _ConditionEditorSheetState();
}

class _ConditionEditorSheetState extends State<_ConditionEditorSheet> {
  String _field = 'summary';
  String _operator = 'contains';
  final _valueController = TextEditingController();

  static const _fields = ['Summary', 'Category', 'App ID', 'Type', 'Description'];
  static const _fieldValues = ['summary', 'category', 'appId', 'type', 'description'];

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('condition-editor-sheet'),
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Add Condition',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),
          DropdownButtonFormField<String>(
            key: const Key('condition-field-dropdown'),
            value: _field,
            decoration: const InputDecoration(labelText: 'Field'),
            items: List.generate(_fields.length, (i) {
              return DropdownMenuItem(
                value: _fieldValues[i],
                child: Text(_fields[i]),
              );
            }),
            onChanged: (val) => setState(() => _field = val!),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            key: const Key('condition-operator-dropdown'),
            value: _operator,
            decoration: const InputDecoration(labelText: 'Operator'),
            items: const [
              DropdownMenuItem(value: 'equals', child: Text('Equals')),
              DropdownMenuItem(value: 'notEquals', child: Text('Not equals')),
              DropdownMenuItem(value: 'contains', child: Text('Contains')),
              DropdownMenuItem(value: 'greaterThan', child: Text('Greater than')),
              DropdownMenuItem(value: 'lessThan', child: Text('Less than')),
            ],
            onChanged: (val) => setState(() => _operator = val!),
          ),
          const SizedBox(height: 16),
          TextField(
            key: const Key('condition-value-field'),
            controller: _valueController,
            decoration: const InputDecoration(
              labelText: 'Value',
              hintText: 'Enter match value...',
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              key: const Key('condition-save'),
              onPressed: () {
                widget.onSave({
                  'field': _field,
                  'operator': _operator,
                  'value': _valueController.text.trim(),
                });
              },
              child: const Text('Add Condition'),
            ),
          ),
        ],
      ),
    );
  }
}
