import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/api/api_exceptions.dart';
import 'package:ohpp_client/core/api/typed_api_client.dart';
import 'package:ohpp_client/core/observability/analytics_sink.dart';
import 'package:ohpp_client/core/auth/biometric_service.dart';
import 'package:ohpp_client/features/pending/attestation_builder.dart';
import 'package:ohpp_client/features/pending/offline_queue_manager.dart';
import 'package:ohpp_client/features/rules/rule_engine.dart';
import 'package:ohpp_client/shared/models/attestation.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/shared/models/models.dart';
import 'package:ohpp_client/shared/models/participation_rule.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

/// Result of an attestation submission attempt.
class SubmitResult {
  final bool success;
  final String? error;
  final bool queued;

  const SubmitResult({required this.success, this.error, this.queued = false});
}

/// Orchestrates the full attestation submission flow:
/// 1. Evaluate rules to determine auth level
/// 2. Biometric authenticate
/// 3. Build and sign attestation
/// 4. Submit to Resolver (or queue offline)
class AttestationService {
  final RuleEngine _ruleEngine;
  final BiometricService _biometricService;
  final AttestationBuilder _attestationBuilder;
  final TypedApiClient _api;
  final OfflineQueueManager? _offlineQueue;
  final AnalyticsSink _analytics;
  final Future<String> Function() getDeviceId;
  final List<ParticipationRule> Function() getRules;

  AttestationService({
    required RuleEngine ruleEngine,
    required BiometricService biometricService,
    required AttestationBuilder attestationBuilder,
    required TypedApiClient api,
    required this.getDeviceId,
    required this.getRules,
    OfflineQueueManager? offlineQueue,
    AnalyticsSink analytics = const NoopAnalyticsSink(),
  })  : _ruleEngine = ruleEngine,
        _biometricService = biometricService,
        _attestationBuilder = attestationBuilder,
        _api = api,
        _offlineQueue = offlineQueue,
        _analytics = analytics;

  /// Submit an attestation for the given request and decision.
  Future<SubmitResult> submit(
    ParticipationRequest request,
    AttestationDecision decision,
  ) async {
    // 0. Reject an already-expired request before doing anything else. The
    // resolver rejects a decision whose timestamp is after the request's
    // expiry (HTTP 400 -> "Validation failed"), which is confusing after a
    // successful biometric. Fail fast, clearly, and don't prompt/sign/submit.
    final expiry = request.expiry;
    if (expiry != null &&
        !expiry.toUtc().isAfter(DateTime.now().toUtc())) {
      await _analytics.capture(AnalyticsEvent.errorShown, properties: {
        'request_type': request.type.name,
        'reason': 'expired',
      });
      return const SubmitResult(
        success: false,
        error: 'This request has expired and can no longer be answered.',
      );
    }

    // 1. Evaluate rules for auth level
    final ruleResult = _ruleEngine.evaluate(request, getRules());

    // 2. Authenticate
    final authResult = await _biometricService.authenticate(
      level: ruleResult.authLevel,
    );
    if (authResult != AuthResult.success) {
      return SubmitResult(
        success: false,
        error: authResult == AuthResult.cancelled
            ? 'Authentication cancelled'
            : 'Authentication failed',
      );
    }

    // 3. Build signed attestation
    final SignedAttestation signed;
    try {
      final deviceId = await getDeviceId();
      signed = await _attestationBuilder.build(
        requestId: request.requestId,
        deviceId: deviceId,
        decision: decision,
        type: request.type,
      );
    } on AttestationValidationError catch (e) {
      return SubmitResult(success: false, error: e.message);
    } on CryptoSigningError catch (e) {
      return SubmitResult(success: false, error: 'Signing failed: ${e.message}');
    }

    // 4. Submit to Resolver.
    // Analytics properties carry only the non-PII request type - never the
    // decision content (which can hold free-text / signature data).
    final baseProps = <String, Object>{
      'request_type': request.type.name,
    };
    try {
      await _api.submitAttestation(
        requestId: signed.requestId,
        attestationPayload: signed.attestationPayload,
        deviceSignature: signed.deviceSignature,
      );
      // Analytics: the user responded to a request (no PII in properties).
      await _analytics.capture(AnalyticsEvent.requestResponded, properties: baseProps);
      return const SubmitResult(success: true);
    } on ConnectivityException {
      // Offline: queue for later delivery
      if (_offlineQueue != null) {
        await _offlineQueue!.enqueue(signed, expiresAt: request.expiry);
        await _analytics.capture(AnalyticsEvent.requestResponded,
            properties: {...baseProps, 'queued': true});
        return const SubmitResult(success: true, queued: true);
      }
      await _analytics.capture(AnalyticsEvent.errorShown,
          properties: {...baseProps, 'reason': 'no_network'});
      return const SubmitResult(success: false, error: 'No network connection');
    } on AlreadyResolvedException {
      await _analytics.capture(AnalyticsEvent.errorShown,
          properties: {...baseProps, 'reason': 'already_resolved'});
      return const SubmitResult(success: false, error: 'Already resolved by another device');
    } on ApiException catch (e) {
      // Other API errors: try to queue
      if (_offlineQueue != null) {
        await _offlineQueue!.enqueue(signed, expiresAt: request.expiry);
        await _analytics.capture(AnalyticsEvent.requestResponded,
            properties: {...baseProps, 'queued': true});
        return const SubmitResult(success: true, queued: true);
      }
      await _analytics.capture(AnalyticsEvent.errorShown,
          properties: {...baseProps, 'reason': 'api_error'});
      return SubmitResult(success: false, error: e.message);
    }
  }
}

/// Provider for the attestation service.
/// Must be overridden in the ProviderScope with real dependencies.
final attestationServiceProvider = Provider<AttestationService>((ref) {
  throw UnimplementedError('attestationServiceProvider must be overridden');
});
