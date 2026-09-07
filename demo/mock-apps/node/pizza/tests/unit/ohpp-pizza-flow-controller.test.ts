import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OhppPizzaFlowController } from '../../src/services/ohpp-pizza-flow-controller.js';
import type { IOhppPizzaFlowStore, IOrderStore, IClock } from '../../src/domain/interfaces.js';
import type { OhppPizzaFlow, Order } from '../../src/domain/types.js';
import type { OhppRequesterClient } from '@ohpp/sdk';
import type { PostgresRegistrationStore } from '../../src/infrastructure/postgres-registration-store.js';

function mockFlowStore(): IOhppPizzaFlowStore {
  const flows = new Map<string, OhppPizzaFlow>();
  return {
    save: vi.fn(async (flow: OhppPizzaFlow) => { flows.set(flow.id, { ...flow }); }),
    getById: vi.fn(async (id: string, userId: string) => {
      const f = flows.get(id); return f && f.userId === userId ? f : null;
    }),
    getActiveByUserId: vi.fn(async (userId: string) => {
      for (const f of flows.values()) {
        if (f.userId === userId && f.status === 'in_progress') return f;
      }
      return null;
    }),
    getByTransactionId: vi.fn(async () => null),
    getAllActive: vi.fn(async () =>
      [...flows.values()].filter((f) => f.status === 'in_progress')),
  };
}

function mockOrderStore(): IOrderStore {
  return {
    save: vi.fn(),
    getById: vi.fn(async () => null),
    getByUserId: vi.fn(async () => []),
    getByParticipationRequestId: vi.fn(async () => null),
    updateStatus: vi.fn(),
  };
}

function mockClock(): IClock {
  return { now: () => new Date('2026-08-05T12:00:00Z'), isoNow: () => '2026-08-05T12:00:00.000Z' };
}

function mockOhppClient(): OhppRequesterClient {
  return {
    sendRequest: vi.fn().mockResolvedValue({ success: true, requestId: 'req-step-1' }),
    getStatus: vi.fn().mockResolvedValue({ success: true, status: 'pending' }),
    cancelRequest: vi.fn().mockResolvedValue({ success: true }),
  } as unknown as OhppRequesterClient;
}

function mockRegistrationStore(connected = true): PostgresRegistrationStore {
  return {
    hasRegistration: vi.fn().mockResolvedValue(connected), getForAppUser: vi.fn().mockResolvedValue(connected ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null),
  } as unknown as PostgresRegistrationStore;
}

describe('OhppPizzaFlowController', () => {
  let controller: OhppPizzaFlowController;
  let flowStore: IOhppPizzaFlowStore;
  let ohppClient: OhppRequesterClient;

  beforeEach(() => {
    flowStore = mockFlowStore();
    ohppClient = mockOhppClient();
    controller = new OhppPizzaFlowController(
      flowStore, mockOrderStore(), ohppClient, mockRegistrationStore(), mockClock(),
    );
  });

  it('startFlow_ohppConnected_createsFlowWithStep1', async () => {
    const result = await controller.startFlow('user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.currentStep).toBe(1);
    expect(result.flow?.status).toBe('in_progress');
    expect(result.flow?.transactionId).toMatch(/^txn-ohpp-pizza-/);
    expect(ohppClient.sendRequest).toHaveBeenCalledTimes(1);
  });

  it('startFlow_ohppNotConnected_returnsError', async () => {
    controller = new OhppPizzaFlowController(
      flowStore, mockOrderStore(), ohppClient, mockRegistrationStore(false), mockClock(),
    );
    const result = await controller.startFlow('user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('startFlow_existingActiveFlow_stillPending_returnsError', async () => {
    // The existing flow's step-1 request is still pending (default mock), so a
    // second flow is correctly rejected.
    await controller.startFlow('user-1');
    const result = await controller.startFlow('user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('startFlow_existingFlowRequestExpired_reconcilesAndStartsNew', async () => {
    // Simulate a stuck flow: the current-step request has expired but the flow
    // was never advanced (user left the screen). Starting a new flow must
    // reconcile the dead flow (abandon it) and proceed rather than block.
    await controller.startFlow('user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'expired' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'req-fresh' });

    const result = await controller.startFlow('user-1');

    expect(result.success).toBe(true);
    expect(result.flow?.currentStep).toBe(1);
    expect(result.flow?.status).toBe('in_progress');
  });

  it('startFlow_existingFlowRequestCancelled_reconcilesAndStartsNew', async () => {
    // A stuck flow whose current-step request was answered with a cancel-style
    // resolution that abandons the flow must not block a new one.
    await controller.startFlow('user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'cancelled' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'req-fresh-2' });

    const result = await controller.startFlow('user-1');

    expect(result.success).toBe(true);
    expect(result.flow?.status).toBe('in_progress');
  });

  it('advanceFlow_step1Resolved_movesToStep2', async () => {
    const start = await controller.startFlow('user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'resolved', selectedOption: 'margherita' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'req-step-2' });

    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.currentStep).toBe(2);
    expect(result.flow?.selections.pizzaKey).toBe('margherita');
  });

  it('advanceFlow_step3MultiSelect_filtersNoneKey', async () => {
    // Set up flow at step 3
    const start = await controller.startFlow('user-1');
    // Advance through steps 1 and 2
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'pepperoni' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'req-next' });
    await controller.advanceFlow(start.flow!.id, 'user-1');

    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'large' });
    await controller.advanceFlow(start.flow!.id, 'user-1');

    // Now at step 3, resolve with multiselect including "none"
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOptions: ['bacon', 'none', 'mushrooms'] });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.selections.toppings).toEqual(['bacon', 'mushrooms']);
  });

  it('advanceFlow_step5Date_validatesWithin7Days', async () => {
    const start = await controller.startFlow('user-1');
    // Advance through steps 1-4
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'margherita' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'req-n' });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'medium' });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOptions: ['none'] });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', value: 'No nuts please' });
    await controller.advanceFlow(start.flow!.id, 'user-1');

    // Step 5: valid date (tomorrow)
    const tomorrow = new Date('2026-08-06T12:00:00Z').toISOString();
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', value: tomorrow });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.selections.deliveryDate).toBe(tomorrow);
  });

  it('advanceFlow_step5Date_rejectsPastDate', async () => {
    const start = await controller.startFlow('user-1');
    // Quick advance to step 5
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'margherita' });
    (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'r' });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'small' });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOptions: ['none'] });
    await controller.advanceFlow(start.flow!.id, 'user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', value: '' });
    await controller.advanceFlow(start.flow!.id, 'user-1');

    // Step 5: past date
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', value: '2020-01-01T00:00:00Z' });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.flow?.status).toBe('cancelled');
  });

  it('advanceFlow_step6Number_acceptsZeroTip', async () => {
    const start = await controller.startFlow('user-1');
    // Advance to step 6 quickly
    const steps = ['margherita', 'medium', null, '', '2026-08-06T12:00:00Z'];
    for (const step of steps) {
      if (step === null) {
        (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOptions: ['none'] });
      } else {
        (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: step, value: step });
      }
      (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'r' });
      await controller.advanceFlow(start.flow!.id, 'user-1');
    }

    // Step 6: zero tip
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', value: '0' });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.selections.tip).toBe(0);
  });

  it('advanceFlow_step7Confirm_createsOrder', async () => {
    const start = await controller.startFlow('user-1');
    // Advance through all steps to step 7
    const mocks = [
      { selectedOption: 'margherita' },
      { selectedOption: 'large' },
      { selectedOptions: ['bacon'] },
      { value: 'Extra crispy' },
      { value: '2026-08-06T12:00:00Z' },
      { value: '5' },
    ];
    for (const m of mocks) {
      (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', ...m });
      (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'r' });
      await controller.advanceFlow(start.flow!.id, 'user-1');
    }
    // Step 7: confirm
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'confirm' });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.flow?.status).toBe('completed');
    expect(result.order).toBeDefined();
    expect(result.order?.status).toBe('confirmed');
  });

  it('advanceFlow_step7Cancel_abandonsFlow', async () => {
    const start = await controller.startFlow('user-1');
    const mocks = [
      { selectedOption: 'margherita' },
      { selectedOption: 'medium' },
      { selectedOptions: ['none'] },
      { value: '' },
      { value: '2026-08-06T12:00:00Z' },
      { value: '0' },
    ];
    for (const m of mocks) {
      (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', ...m });
      (ohppClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, requestId: 'r' });
      await controller.advanceFlow(start.flow!.id, 'user-1');
    }
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, status: 'resolved', selectedOption: 'cancel' });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.flow?.status).toBe('cancelled');
  });

  it('advanceFlow_stepExpired_abandonsEntireFlow', async () => {
    const start = await controller.startFlow('user-1');
    (ohppClient.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'expired' });
    const result = await controller.advanceFlow(start.flow!.id, 'user-1');
    expect(result.flow?.status).toBe('expired');
  });

  it('getFlowStatus_returnsCurrentStepAndProgress', async () => {
    await controller.startFlow('user-1');
    const result = await controller.getFlowStatus('user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.currentStep).toBe(1);
    expect(result.flow?.totalSteps).toBe(7);
  });

  it('cancelFlow_cancelsActiveOhppRequest', async () => {
    const start = await controller.startFlow('user-1');
    const result = await controller.cancelFlow(start.flow!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.flow?.status).toBe('cancelled');
    expect(ohppClient.cancelRequest).toHaveBeenCalled();
  });

  it('cancelFlow_noActiveRequest_returnsError', async () => {
    const result = await controller.cancelFlow('nonexistent', 'user-1');
    expect(result.success).toBe(false);
  });
});
