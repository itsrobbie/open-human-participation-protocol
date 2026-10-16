import 'package:ohpp_client/shared/models/models.dart';

/// Interface for the offline queue storage (implemented by DB layer).
abstract class OfflineQueueStore {
  Future<void> insert(QueueEntry entry);
  Future<List<QueueEntry>> getPending();
  Future<void> updateStatus(String id, QueueStatus status);
  Future<void> incrementAttempts(String id, DateTime attemptTime);
  Future<int> getPendingCount();
}

/// Interface for submitting attestations to the Resolver.
abstract class AttestationSubmitter {
  /// Returns null on success, or an error code string on failure.
  Future<String?> submit(SignedAttestation attestation);
}

/// A queue entry representing a signed attestation awaiting delivery.
class QueueEntry {
  final String id;
  final SignedAttestation attestation;
  final int attempts;
  final DateTime? lastAttemptAt;
  final DateTime? expiresAt;
  final QueueStatus status;
  final DateTime createdAt;

  const QueueEntry({
    required this.id,
    required this.attestation,
    this.attempts = 0,
    this.lastAttemptAt,
    this.expiresAt,
    this.status = QueueStatus.pending,
    required this.createdAt,
  });
}

/// Result of a drain operation.
class DrainResult {
  final int delivered;
  final int failed;
  final int expired;
  final int remaining;

  const DrainResult({
    this.delivered = 0,
    this.failed = 0,
    this.expired = 0,
    this.remaining = 0,
  });
}

/// Manages the offline attestation delivery queue.
/// Enqueues signed attestations when offline, drains when connectivity returns.
class OfflineQueueManager {
  final OfflineQueueStore _store;
  final AttestationSubmitter _submitter;
  final int maxAttempts;

  bool _draining = false;

  OfflineQueueManager({
    required OfflineQueueStore store,
    required AttestationSubmitter submitter,
    this.maxAttempts = 5,
  })  : _store = store,
        _submitter = submitter;

  /// Add a signed attestation to the offline queue.
  Future<QueueEntry> enqueue(SignedAttestation attestation, {DateTime? expiresAt}) async {
    final entry = QueueEntry(
      id: 'q-${DateTime.now().microsecondsSinceEpoch}',
      attestation: attestation,
      expiresAt: expiresAt,
      createdAt: DateTime.now().toUtc(),
    );
    await _store.insert(entry);
    return entry;
  }

  /// Get the current number of pending queue entries.
  Future<int> getQueueCount() => _store.getPendingCount();

  /// Get all pending entries.
  Future<List<QueueEntry>> getPendingEntries() => _store.getPending();

  /// Drain the queue: attempt delivery for all pending entries.
  /// Uses mutex to prevent concurrent drains.
  /// Processes oldest first (FIFO). Skips expired entries.
  Future<DrainResult> drain() async {
    if (_draining) {
      return const DrainResult();
    }
    _draining = true;

    try {
      final entries = await _store.getPending();
      var delivered = 0;
      var failed = 0;
      var expired = 0;

      for (final entry in entries) {
        // Check expiry
        if (entry.expiresAt != null && entry.expiresAt!.isBefore(DateTime.now().toUtc())) {
          await _store.updateStatus(entry.id, QueueStatus.expired);
          expired++;
          continue;
        }

        // Check max attempts
        if (entry.attempts >= maxAttempts) {
          await _store.updateStatus(entry.id, QueueStatus.failed);
          failed++;
          continue;
        }

        // Attempt delivery
        final error = await _submitter.submit(entry.attestation);

        if (error == null) {
          await _store.updateStatus(entry.id, QueueStatus.delivered);
          delivered++;
        } else if (error == 'CONFLICT') {
          // Already resolved by another device
          await _store.updateStatus(entry.id, QueueStatus.failed);
          failed++;
        } else {
          // Transient failure
          await _store.incrementAttempts(entry.id, DateTime.now().toUtc());
        }
      }

      final remaining = await _store.getPendingCount();
      return DrainResult(
        delivered: delivered,
        failed: failed,
        expired: expired,
        remaining: remaining,
      );
    } finally {
      _draining = false;
    }
  }
}
