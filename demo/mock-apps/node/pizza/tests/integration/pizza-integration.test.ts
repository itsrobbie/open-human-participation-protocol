/**
 * Pizza App Integration Tests.
 * Tests service interactions end-to-end with in-memory stores.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '../../src/services/order-service.js';
import { StandardOrderService } from '../../src/services/standard-order-service.js';
import { OhppPizzaFlowController } from '../../src/services/ohpp-pizza-flow-controller.js';
import type { IOrderStore, IMenuStore, IOhppPizzaFlowStore, IClock } from '../../src/domain/interfaces.js';
import type { Order, OhppPizzaFlow, MenuItem, Topping } from '../../src/domain/types.js';
import type { OhppRequesterClient, CredentialStore, RegistrationCredentials } from '@ohpp/sdk';

// --- In-memory stores ---

function createInMemoryOrderStore(): IOrderStore {
  const orders: Order[] = [];
  return {
    save: vi.fn(async (o: Order) => {
      const idx = orders.findIndex((x) => x.id === o.id);
      if (idx >= 0) orders[idx] = o; else orders.push(o);
    }),
    getById: vi.fn(async (id: string, userId: string) =>
      orders.find((o) => o.id === id && o.userId === userId) ?? null),
    getByUserId: vi.fn(async (userId: string) =>
      orders.filter((o) => o.userId === userId)),
    getByParticipationRequestId: vi.fn(async (reqId: string) =>
      orders.find((o) => o.participationRequestId === reqId) ?? null),
    updateStatus: vi.fn(async (id: string, status: string, updatedAt: string) => {
      const o = orders.find((x) => x.id === id);
      if (o) { o.status = status as Order['status']; o.updatedAt = updatedAt; }
    }),
  };
}

function createInMemoryFlowStore(): IOhppPizzaFlowStore {
  const flows: OhppPizzaFlow[] = [];
  return {
    save: vi.fn(async (f: OhppPizzaFlow) => {
      const idx = flows.findIndex((x) => x.id === f.id);
      if (idx >= 0) flows[idx] = f; else flows.push(f);
    }),
    getById: vi.fn(async (id: string, userId: string) =>
      flows.find((f) => f.id === id && f.userId === userId) ?? null),
    getActiveByUserId: vi.fn(async (userId: string) =>
      flows.find((f) => f.userId === userId && f.status === 'in_progress') ?? null),
    getByTransactionId: vi.fn(async (txnId: string) =>
      flows.find((f) => f.transactionId === txnId) ?? null),
  };
}

function createMockClock(): IClock {
  return { now: () => new Date('2026-08-01T12:00:00Z'), isoNow: () => '2026-08-01T12:00:00.000Z' };
}

function createMockRegistrationStore(hasReg: boolean = true) {
  return {
    store: vi.fn(async () => {}),
    get: vi.fn(async () => hasReg ? { challengeId: 'ch', resolverBaseUrl: 'http://resolver:8080', userId: 'user-1', accessToken: 'tok', registrationId: 'r1', createdAt: '2026-07-01T10:00:00Z' } : null),
    getAll: vi.fn(async () => []),
    delete: vi.fn(async () => {}),
    hasRegistration: vi.fn(async () => hasReg), getForAppUser: vi.fn(async () => hasReg ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null),
  } as unknown as CredentialStore & { hasRegistration: (userId: string) => Promise<boolean> };
}

let requestCounter = 0;
function createSequentialOhppClient(responses: Array<{ status: string; selectedOption?: string; selectedOptions?: string[]; value?: string }>) {
  let pollIndex = 0;
  return {
    sendRequest: vi.fn(async () => ({ success: true, requestId: `req-${++requestCounter}` })),
    getStatus: vi.fn(async () => {
      const resp = responses[pollIndex] ?? { status: 'pending' };
      pollIndex++;
      return { success: true, ...resp };
    }),
    cancelRequest: vi.fn(async () => ({ success: true })),
  } as unknown as OhppRequesterClient;
}

describe('Pizza Integration', () => {
  describe('Standard Order Full Flow', () => {
    it('createToPending_resolveToConfirmed', async () => {
      const orderStore = createInMemoryOrderStore();
      const clock = createMockClock();
      const regStore = createMockRegistrationStore(true);
      const ohppClient = createSequentialOhppClient([{ status: 'resolved', selectedOption: 'confirm' }]);

      const orderService = new OrderService(orderStore, clock);
      const standardService = new StandardOrderService(orderService, ohppClient, regStore);

      // Checkout
      const checkoutResult = await standardService.checkout({
        userId: 'user-1',
        items: [{ id: 'ci-1', menuItemId: 'margherita', name: 'Margherita', quantity: 1, unitPrice: 999, totalPrice: 999 }],
        deliveryAddress: { line1: '1 Test St', city: 'London', postcode: 'E1 1AA' },
      });

      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.order!.status).toBe('pending_confirmation');

      // Resolve
      const resolveResult = await standardService.resolveOrder(checkoutResult.order!.id, 'user-1');
      expect(resolveResult.success).toBe(true);
      expect(resolveResult.order!.status).toBe('confirmed');
    });
  });

  describe('OHPP Pizza Flow', () => {
    it('fullFlow_allStepsResolve_orderCreated', async () => {
      const orderStore = createInMemoryOrderStore();
      const flowStore = createInMemoryFlowStore();
      const clock = createMockClock();
      const regStore = createMockRegistrationStore(true);

      // Each step resolves in sequence
      const responses = [
        { status: 'resolved', selectedOption: 'margherita' },  // step 1
        { status: 'resolved', selectedOption: 'medium' },      // step 2
        { status: 'resolved', selectedOptions: ['mushrooms', 'bacon'] }, // step 3
        { status: 'resolved', value: 'No onion please' },     // step 4
        { status: 'resolved', value: '2026-08-03' },           // step 5
        { status: 'resolved', value: '2.50' },                 // step 6
        { status: 'resolved', selectedOption: 'confirm' },     // step 7
      ];
      const ohppClient = createSequentialOhppClient(responses);

      const controller = new OhppPizzaFlowController(flowStore, orderStore, ohppClient, regStore, clock);

      // Start flow
      const startResult = await controller.startFlow('user-1');
      expect(startResult.success).toBe(true);
      expect(startResult.flow!.currentStep).toBe(1);

      // Advance through all 7 steps
      let flow = startResult.flow!;
      for (let step = 1; step <= 7; step++) {
        const advanceResult = await controller.advanceFlow(flow.id, 'user-1');
        expect(advanceResult.success).toBe(true);
        flow = advanceResult.flow!;
      }

      expect(flow.status).toBe('completed');
    });

    it('stepExpires_flowAbandoned', async () => {
      const orderStore = createInMemoryOrderStore();
      const flowStore = createInMemoryFlowStore();
      const clock = createMockClock();
      const regStore = createMockRegistrationStore(true);
      const ohppClient = createSequentialOhppClient([{ status: 'expired' }]);

      const controller = new OhppPizzaFlowController(flowStore, orderStore, ohppClient, regStore, clock);
      const startResult = await controller.startFlow('user-1');

      const advanceResult = await controller.advanceFlow(startResult.flow!.id, 'user-1');
      expect(advanceResult.flow!.status).toBe('expired');
    });

    it('cancelMidFlow_flowAbandoned', async () => {
      const orderStore = createInMemoryOrderStore();
      const flowStore = createInMemoryFlowStore();
      const clock = createMockClock();
      const regStore = createMockRegistrationStore(true);
      const ohppClient = createSequentialOhppClient([]);

      const controller = new OhppPizzaFlowController(flowStore, orderStore, ohppClient, regStore, clock);
      const startResult = await controller.startFlow('user-1');

      const cancelResult = await controller.cancelFlow(startResult.flow!.id, 'user-1');
      expect(cancelResult.flow!.status).toBe('cancelled');
      expect(ohppClient.cancelRequest).toHaveBeenCalled();
    });
  });
});
