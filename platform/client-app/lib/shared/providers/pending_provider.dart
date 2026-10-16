import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/observability/analytics_sink.dart';
import 'package:ohpp_client/core/observability/dev_logger.dart';

/// State for the pending requests list.
class PendingState {
  final List<Map<String, dynamic>> requests;
  final bool isLoading;
  final String? error;
  final int offlineQueueCount;

  const PendingState({
    this.requests = const [],
    this.isLoading = false,
    this.error,
    this.offlineQueueCount = 0,
  });

  PendingState copyWith({
    List<Map<String, dynamic>>? requests,
    bool? isLoading,
    String? error,
    int? offlineQueueCount,
  }) {
    return PendingState(
      requests: requests ?? this.requests,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      offlineQueueCount: offlineQueueCount ?? this.offlineQueueCount,
    );
  }
}

/// Interface for fetching pending requests (injected dependency).
abstract class PendingDataSource {
  Future<List<Map<String, dynamic>>> fetchPending();
  List<Map<String, dynamic>> getCached();
}

/// Manages pending participation requests with stale-while-revalidate.
class PendingNotifier extends StateNotifier<PendingState> {
  final PendingDataSource _dataSource;
  final AnalyticsSink _analytics;

  PendingNotifier({
    required PendingDataSource dataSource,
    AnalyticsSink analytics = const NoopAnalyticsSink(),
  })  : _dataSource = dataSource,
        _analytics = analytics,
        super(const PendingState()) {
    _init();
  }

  void _init() {
    // Show cached immediately
    final cached = _dataSource.getCached();
    state = state.copyWith(requests: cached);
    // Refresh in background
    refresh();
  }

  Future<void> refresh() async {
    if (!mounted) return;
    state = state.copyWith(isLoading: true, error: null);
    DevLog.instance.debug('pending', 'Refreshing pending requests…');
    try {
      final fresh = await _dataSource.fetchPending();
      // The await can outlive the notifier (e.g. logout disposes it mid-fetch);
      // writing state after dispose throws. Guard with `mounted`.
      if (!mounted) return;
      DevLog.instance.info('pending', 'Loaded ${fresh.length} pending request(s)');
      state = state.copyWith(requests: fresh, isLoading: false);
    } catch (e) {
      if (!mounted) return;
      // Keep existing requests on failure (stale-while-revalidate)
      DevLog.instance.error('pending',
          'Failed to load pending requests (main page shows "something went wrong")',
          detail: e.toString());
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void addFromSse(Map<String, dynamic> request) {
    // Diagnostic: confirm the SSE payload uses the camelCase contract the UI
    // reads. A null requestId here means the server emitted PascalCase and the
    // card would render blank.
    DevLog.instance.debug('pending',
        'SSE new_request: requestId=${request['requestId']} '
        'appId=${request['appId']} summary=${request['summary']}');
    final current = List<Map<String, dynamic>>.from(state.requests);
    // Dedup by requestId
    if (!current.any((r) => r['requestId'] == request['requestId'])) {
      current.insert(0, request);
      state = state.copyWith(requests: current);
      // Analytics: a new participation request arrived (non-PII props only).
      _analytics.capture(AnalyticsEvent.requestReceived, properties: {
        if (request['type'] is String) 'request_type': request['type'] as String,
      });
    }
  }

  /// Remove a request from the pending list by id (e.g. on an SSE
  /// request_expired / request_cancelled event).
  void removeById(String requestId) {
    if (requestId.isEmpty) return;
    final current = List<Map<String, dynamic>>.from(state.requests);
    final kept =
        current.where((r) => r['requestId'] != requestId).toList();
    if (kept.length != current.length) {
      state = state.copyWith(requests: kept);
    }
  }

  /// Remove requests whose expiry has passed, emitting request_expired for each.
  /// Call from a periodic sweep or on refresh where expiry is evaluated.
  void expireStale(DateTime now) {
    final current = List<Map<String, dynamic>>.from(state.requests);
    final kept = <Map<String, dynamic>>[];
    var expiredCount = 0;
    for (final r in current) {
      final expiryRaw = r['expiry'];
      final expiry = expiryRaw is String ? DateTime.tryParse(expiryRaw) : null;
      if (expiry != null && expiry.isBefore(now)) {
        expiredCount++;
        _analytics.capture(AnalyticsEvent.requestExpired, properties: {
          if (r['type'] is String) 'request_type': r['type'] as String,
        });
      } else {
        kept.add(r);
      }
    }
    if (expiredCount > 0) {
      state = state.copyWith(requests: kept);
    }
  }

  void updateQueueCount(int count) {
    state = state.copyWith(offlineQueueCount: count);
  }
}

final pendingProvider =
    StateNotifierProvider<PendingNotifier, PendingState>((ref) {
  throw UnimplementedError('Must be overridden with data source');
});
