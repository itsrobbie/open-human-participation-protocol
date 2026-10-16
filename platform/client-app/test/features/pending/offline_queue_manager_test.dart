import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/features/pending/offline_queue_manager.dart';
import 'package:ohpp_client/shared/models/models.dart';

void main() {
  late OfflineQueueManager manager;
  late _FakeQueueStore store;
  late _FakeSubmitter submitter;

  setUp(() {
    store = _FakeQueueStore();
    submitter = _FakeSubmitter();
    manager = OfflineQueueManager(store: store, submitter: submitter, maxAttempts: 5);
  });

  SignedAttestation makeAttestation({String requestId = 'req-1'}) {
    return SignedAttestation(
      requestId: requestId,
      attestationPayload: '{"selectedOption":"approve"}',
      deviceSignature: 'sig_123',
      deviceId: 'dev-1',
      signedAt: DateTime.now().toUtc(),
    );
  }

  // --- Happy path ---

  group('Enqueue', () {
    test('enqueue_StoresAttestationInDB', () async {
      await manager.enqueue(makeAttestation());

      expect(store.entries.length, equals(1));
      expect(store.entries.first.attestation.requestId, equals('req-1'));
    });

    test('enqueue_ReturnsQueueEntry', () async {
      final entry = await manager.enqueue(makeAttestation());

      expect(entry.id, isNotEmpty);
      expect(entry.status, equals(QueueStatus.pending));
      expect(entry.attempts, equals(0));
    });
  });

  group('Drain - happy path', () {
    test('drain_OnlineWithEntries_AttemptsDelivery', () async {
      await manager.enqueue(makeAttestation());

      final result = await manager.drain();

      expect(submitter.submitCount, equals(1));
      expect(result.delivered, equals(1));
    });

    test('drain_DeliverySuccess_MarksDelivered', () async {
      await manager.enqueue(makeAttestation());

      await manager.drain();

      expect(store.entries.first.status, equals(QueueStatus.delivered));
    });

    test('drain_MultipleEntries_ProcessesFIFO', () async {
      await manager.enqueue(makeAttestation(requestId: 'req-1'));
      await manager.enqueue(makeAttestation(requestId: 'req-2'));
      await manager.enqueue(makeAttestation(requestId: 'req-3'));

      await manager.drain();

      // All delivered in order
      expect(submitter.submittedIds, equals(['req-1', 'req-2', 'req-3']));
    });

    test('drain_AfterDrain_QueueCountDecreases', () async {
      await manager.enqueue(makeAttestation());

      expect(await manager.getQueueCount(), equals(1));
      await manager.drain();
      expect(await manager.getQueueCount(), equals(0));
    });

    test('getQueueCount_ReturnsCorrectCount', () async {
      expect(await manager.getQueueCount(), equals(0));
      await manager.enqueue(makeAttestation(requestId: 'a'));
      await manager.enqueue(makeAttestation(requestId: 'b'));
      expect(await manager.getQueueCount(), equals(2));
    });

    test('getPendingEntries_ReturnsOnlyPending', () async {
      await manager.enqueue(makeAttestation());
      final entries = await manager.getPendingEntries();
      expect(entries.length, equals(1));
    });
  });

  // --- Non-happy path ---

  group('Drain - failures', () {
    test('drain_Delivery409_MarksFailedAlreadyResolved', () async {
      submitter.errorToReturn = 'CONFLICT';
      await manager.enqueue(makeAttestation());

      final result = await manager.drain();

      expect(result.failed, equals(1));
      expect(store.entries.first.status, equals(QueueStatus.failed));
    });

    test('drain_Delivery5xx_IncrementsAttempts', () async {
      submitter.errorToReturn = 'SERVER_ERROR';
      await manager.enqueue(makeAttestation());

      await manager.drain();

      expect(store.entries.first.attempts, equals(1));
      expect(store.entries.first.status, equals(QueueStatus.pending));
    });

    test('drain_MaxAttemptsReached_MarksFailed', () async {
      // Pre-load an entry with maxAttempts already reached
      store.entries.add(QueueEntry(
        id: 'q-old',
        attestation: makeAttestation(),
        attempts: 5,
        status: QueueStatus.pending,
        createdAt: DateTime.now().toUtc(),
      ));

      final result = await manager.drain();

      expect(result.failed, equals(1));
      expect(store.entries.first.status, equals(QueueStatus.failed));
    });

    test('drain_ExpiredEntry_MarksExpiredSkipsDelivery', () async {
      store.entries.add(QueueEntry(
        id: 'q-expired',
        attestation: makeAttestation(),
        expiresAt: DateTime.now().toUtc().subtract(const Duration(minutes: 5)),
        status: QueueStatus.pending,
        createdAt: DateTime.now().toUtc(),
      ));

      final result = await manager.drain();

      expect(result.expired, equals(1));
      expect(submitter.submitCount, equals(0)); // Never attempted
      expect(store.entries.first.status, equals(QueueStatus.expired));
    });

    test('drain_ConcurrentDrainPrevented_MutexHeld', () async {
      submitter.delay = const Duration(milliseconds: 100);
      await manager.enqueue(makeAttestation());

      // Start two drains concurrently
      final future1 = manager.drain();
      final future2 = manager.drain();

      final result1 = await future1;
      final result2 = await future2;

      // One should process, the other should return empty
      expect(result1.delivered + result2.delivered, equals(1));
    });

    test('drain_EmptyQueue_NoOp', () async {
      final result = await manager.drain();

      expect(result.delivered, equals(0));
      expect(result.failed, equals(0));
      expect(result.expired, equals(0));
      expect(submitter.submitCount, equals(0));
    });
  });
}

/// In-memory fake queue store for testing.
class _FakeQueueStore implements OfflineQueueStore {
  final List<QueueEntry> entries = [];

  @override
  Future<void> insert(QueueEntry entry) async {
    entries.add(entry);
  }

  @override
  Future<List<QueueEntry>> getPending() async {
    return entries.where((e) => e.status == QueueStatus.pending).toList();
  }

  @override
  Future<void> updateStatus(String id, QueueStatus status) async {
    final index = entries.indexWhere((e) => e.id == id);
    if (index >= 0) {
      final old = entries[index];
      entries[index] = QueueEntry(
        id: old.id,
        attestation: old.attestation,
        attempts: old.attempts,
        lastAttemptAt: old.lastAttemptAt,
        expiresAt: old.expiresAt,
        status: status,
        createdAt: old.createdAt,
      );
    }
  }

  @override
  Future<void> incrementAttempts(String id, DateTime attemptTime) async {
    final index = entries.indexWhere((e) => e.id == id);
    if (index >= 0) {
      final old = entries[index];
      entries[index] = QueueEntry(
        id: old.id,
        attestation: old.attestation,
        attempts: old.attempts + 1,
        lastAttemptAt: attemptTime,
        expiresAt: old.expiresAt,
        status: old.status,
        createdAt: old.createdAt,
      );
    }
  }

  @override
  Future<int> getPendingCount() async {
    return entries.where((e) => e.status == QueueStatus.pending).length;
  }
}

/// Fake submitter that can be configured to succeed or fail.
class _FakeSubmitter implements AttestationSubmitter {
  String? errorToReturn;
  int submitCount = 0;
  List<String> submittedIds = [];
  Duration delay = Duration.zero;

  @override
  Future<String?> submit(SignedAttestation attestation) async {
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    submitCount++;
    submittedIds.add(attestation.requestId);
    return errorToReturn;
  }
}
