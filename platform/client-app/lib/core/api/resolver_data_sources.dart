import 'package:ohpp_client/core/api/typed_api_client.dart';
import 'package:ohpp_client/shared/providers/apps_provider.dart';
import 'package:ohpp_client/shared/providers/history_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';
import 'package:ohpp_client/shared/providers/rules_provider.dart';

/// Real data source for pending requests backed by [TypedApiClient].
class ResolverPendingDataSource implements PendingDataSource {
  final TypedApiClient _api;
  List<Map<String, dynamic>> _cached = [];

  ResolverPendingDataSource({required TypedApiClient api}) : _api = api;

  @override
  List<Map<String, dynamic>> getCached() => _cached;

  @override
  Future<List<Map<String, dynamic>>> fetchPending() async {
    final result = await _api.getPendingRequests();
    _cached = result;
    return result;
  }
}

/// Real data source for participation rules backed by [TypedApiClient].
class ResolverRulesDataSource implements RulesDataSource {
  final TypedApiClient _api;

  ResolverRulesDataSource({required TypedApiClient api}) : _api = api;

  @override
  Future<List<Map<String, dynamic>>> fetchRules() => _api.getRules();

  @override
  Future<Map<String, dynamic>> createRule(Map<String, dynamic> data) =>
      _api.createRule(data);

  @override
  Future<void> deleteRule(String id) => _api.deleteRule(id);
}

/// Real data source for registered apps backed by [TypedApiClient].
class ResolverAppsDataSource implements AppsDataSource {
  final TypedApiClient _api;

  ResolverAppsDataSource({required TypedApiClient api}) : _api = api;

  @override
  Future<List<Map<String, dynamic>>> fetchApps() => _api.getRegisteredApps();

  @override
  Future<void> revokeApp(String appId) => _api.revokeApp(appId);

  @override
  Future<void> setNotificationPreference(String appId, bool enabled) =>
      _api.updateNotificationPreference(appId, {'pushEnabled': enabled});

  @override
  Future<Map<String, dynamic>> processChallenge(String base64Payload) =>
      _api.processChallenge(base64Payload);
}

/// Real data source for participation history backed by [TypedApiClient].
class ResolverHistoryDataSource implements HistoryDataSource {
  final TypedApiClient _api;

  ResolverHistoryDataSource({required TypedApiClient api}) : _api = api;

  @override
  Future<Map<String, dynamic>> fetchHistory({
    required int page,
    required int pageSize,
  }) =>
      _api.getHistory(page: page, pageSize: pageSize);
}
