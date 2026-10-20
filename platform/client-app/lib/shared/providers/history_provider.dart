import 'package:flutter_riverpod/flutter_riverpod.dart';

/// State for paginated history.
class HistoryState {
  final List<Map<String, dynamic>> entries;
  final bool isLoading;
  final int page;
  final int totalCount;
  final String? error;

  const HistoryState({
    this.entries = const [],
    this.isLoading = false,
    this.page = 1,
    this.totalCount = 0,
    this.error,
  });

  HistoryState copyWith({
    List<Map<String, dynamic>>? entries,
    bool? isLoading,
    int? page,
    int? totalCount,
    String? error,
  }) {
    return HistoryState(
      entries: entries ?? this.entries,
      isLoading: isLoading ?? this.isLoading,
      page: page ?? this.page,
      totalCount: totalCount ?? this.totalCount,
      error: error,
    );
  }

  bool get hasMore => entries.length < totalCount;
}

/// Interface for history data operations.
abstract class HistoryDataSource {
  Future<Map<String, dynamic>> fetchHistory({required int page, required int pageSize});
}

/// Manages paginated participation history.
class HistoryNotifier extends StateNotifier<HistoryState> {
  final HistoryDataSource _dataSource;

  HistoryNotifier({required HistoryDataSource dataSource})
      : _dataSource = dataSource,
        super(const HistoryState());

  Future<void> fetchFirstPage() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _dataSource.fetchHistory(page: 1, pageSize: 20);
      if (!mounted) return;
      final items = (result['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      state = state.copyWith(
        entries: items,
        page: 1,
        totalCount: result['totalCount'] as int? ?? 0,
        isLoading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoading) return;
    final nextPage = state.page + 1;
    state = state.copyWith(isLoading: true);
    try {
      final result = await _dataSource.fetchHistory(page: nextPage, pageSize: 20);
      if (!mounted) return;
      final items = (result['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      state = state.copyWith(
        entries: [...state.entries, ...items],
        page: nextPage,
        totalCount: result['totalCount'] as int? ?? state.totalCount,
        isLoading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final historyProvider =
    StateNotifierProvider<HistoryNotifier, HistoryState>((ref) {
  throw UnimplementedError('Must be overridden with data source');
});
