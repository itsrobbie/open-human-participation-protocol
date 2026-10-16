import 'package:flutter_riverpod/flutter_riverpod.dart';

/// State for participation rules.
class RulesState {
  final List<Map<String, dynamic>> rules;
  final bool isLoading;
  final String? error;

  const RulesState({
    this.rules = const [],
    this.isLoading = false,
    this.error,
  });

  RulesState copyWith({
    List<Map<String, dynamic>>? rules,
    bool? isLoading,
    String? error,
  }) {
    return RulesState(
      rules: rules ?? this.rules,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Interface for rules data operations.
abstract class RulesDataSource {
  Future<List<Map<String, dynamic>>> fetchRules();
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data);
  Future<void> deleteRule(String id);
}

/// Manages participation rules with optimistic updates and server sync.
class RulesNotifier extends StateNotifier<RulesState> {
  final RulesDataSource _dataSource;

  RulesNotifier({required RulesDataSource dataSource})
      : _dataSource = dataSource,
        super(const RulesState());

  Future<void> fetch() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final rules = await _dataSource.fetchRules();
      if (!mounted) return;
      state = state.copyWith(rules: rules, isLoading: false);
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Optimistic create: add locally first, sync to server, rollback on failure.
  Future<bool> create(Map<String, dynamic> ruleData) async {
    final optimistic = {...ruleData, 'id': 'temp-${DateTime.now().millisecondsSinceEpoch}'};
    final previous = List<Map<String, dynamic>>.from(state.rules);

    // Optimistic update
    state = state.copyWith(rules: [...previous, optimistic]);

    try {
      final created = await _dataSource.createRule(ruleData);
      // Replace temp with real
      final updated = state.rules
          .map((r) => r['id'] == optimistic['id'] ? created : r)
          .toList();
      state = state.copyWith(rules: updated);
      return true;
    } catch (_) {
      // Rollback
      state = state.copyWith(rules: previous);
      return false;
    }
  }

  /// Optimistic delete: remove locally first, sync to server, rollback on failure.
  Future<bool> delete(String id) async {
    final previous = List<Map<String, dynamic>>.from(state.rules);

    // Optimistic remove
    state = state.copyWith(
      rules: state.rules.where((r) => r['id'] != id).toList(),
    );

    try {
      await _dataSource.deleteRule(id);
      return true;
    } catch (_) {
      // Rollback
      state = state.copyWith(rules: previous);
      return false;
    }
  }
}

final rulesProvider = StateNotifierProvider<RulesNotifier, RulesState>((ref) {
  throw UnimplementedError('Must be overridden with data source');
});
