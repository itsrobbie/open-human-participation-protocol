import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowSequencer } from '../../src/services/flow-sequencer.js';
import type { IOhppPizzaFlowStore } from '../../src/domain/interfaces.js';
import type { OhppPizzaFlow } from '../../src/domain/types.js';
import type { OhppPizzaFlowController } from '../../src/services/ohpp-pizza-flow-controller.js';

function flow(id: string, userId: string): OhppPizzaFlow {
  return {
    id,
    userId,
    transactionId: `txn-${id}`,
    currentStep: 1,
    totalSteps: 7,
    status: 'in_progress',
    selections: {},
    createdAt: '2026-08-05T12:00:00.000Z',
    updatedAt: '2026-08-05T12:00:00.000Z',
  };
}

function mockFlowStore(active: OhppPizzaFlow[]): IOhppPizzaFlowStore {
  return {
    save: vi.fn(),
    getById: vi.fn(),
    getActiveByUserId: vi.fn(),
    getByTransactionId: vi.fn(),
    getAllActive: vi.fn(async () => active),
  };
}

function mockController(): OhppPizzaFlowController {
  return {
    advanceFlow: vi.fn(async () => ({ success: true })),
  } as unknown as OhppPizzaFlowController;
}

describe('FlowSequencer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconcileOnce advances every active flow with its own userId', async () => {
    const store = mockFlowStore([flow('f1', 'user-1'), flow('f2', 'user-2')]);
    const controller = mockController();
    const seq = new FlowSequencer(store, controller, { intervalMs: 1000 });

    await seq.reconcileOnce();

    expect(controller.advanceFlow).toHaveBeenCalledTimes(2);
    expect(controller.advanceFlow).toHaveBeenCalledWith('f1', 'user-1');
    expect(controller.advanceFlow).toHaveBeenCalledWith('f2', 'user-2');
  });

  it('reconcileOnce does nothing when there are no active flows', async () => {
    const store = mockFlowStore([]);
    const controller = mockController();
    const seq = new FlowSequencer(store, controller, { intervalMs: 1000 });

    await seq.reconcileOnce();

    expect(controller.advanceFlow).not.toHaveBeenCalled();
  });

  it('one flow failing does not stop the others (best-effort)', async () => {
    const store = mockFlowStore([flow('f1', 'user-1'), flow('f2', 'user-2')]);
    const controller = mockController();
    (controller.advanceFlow as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === 'f1') throw new Error('boom');
      return { success: true };
    });
    const seq = new FlowSequencer(store, controller, { intervalMs: 1000 });

    await expect(seq.reconcileOnce()).resolves.not.toThrow();
    expect(controller.advanceFlow).toHaveBeenCalledWith('f2', 'user-2');
  });

  it('does not overlap ticks: a slow reconcile is not re-entered', async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    const store = mockFlowStore([flow('f1', 'user-1')]);
    const controller = mockController();
    (controller.advanceFlow as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<{ success: boolean }>((resolve) => { resolveFirst = () => resolve({ success: true }); }),
    );
    const seq = new FlowSequencer(store, controller, { intervalMs: 1000 });

    seq.start();
    // First tick fires and is now "in flight" (advanceFlow pending).
    await vi.advanceTimersByTimeAsync(1000);
    // Second tick fires while the first is still running — must be skipped.
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.advanceFlow).toHaveBeenCalledTimes(1);

    // Let the first finish; a later tick may run again.
    resolveFirst?.();
    seq.stop();
  });

  it('start is idempotent and stop halts the loop', async () => {
    vi.useFakeTimers();
    const store = mockFlowStore([]);
    const controller = mockController();
    const listSpy = store.getAllActive as ReturnType<typeof vi.fn>;
    const seq = new FlowSequencer(store, controller, { intervalMs: 1000 });

    seq.start();
    seq.start(); // second start must not create a second timer
    await vi.advanceTimersByTimeAsync(1000);
    const callsAfterOneTick = listSpy.mock.calls.length;
    expect(callsAfterOneTick).toBe(1);

    seq.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(listSpy.mock.calls.length).toBe(callsAfterOneTick); // no more ticks
  });
});
