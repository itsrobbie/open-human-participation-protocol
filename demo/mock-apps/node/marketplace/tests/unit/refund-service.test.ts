import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RefundService } from '../../src/services/refund-service.js';
import type { IRefundStore, IPurchaseStore, IClock } from '../../src/domain/interfaces.js';
import type { Purchase, RefundRequest, ShippingAddress } from '../../src/domain/types.js';
import type { OhppRequesterClient, CredentialStore, RegistrationCredentials } from '@ohpp/sdk';

function makeAddress(): ShippingAddress {
  return { line1: '123 Test St', city: 'London', postcode: 'E1 1AA', country: 'UK' };
}

function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'purchase-1',
    buyerId: 'user-1',
    items: [{ productId: 'p1', productName: 'Test', quantity: 1, unitPrice: 4999, totalPrice: 4999 }],
    subtotal: 4999,
    shippingCost: 499,
    total: 5498,
    status: 'delivered',
    shippingAddress: makeAddress(),
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-25T10:00:00Z',
    ...overrides,
  };
}

function createMockClock(): IClock {
  return {
    now: () => new Date('2026-08-01T12:00:00Z'),
    isoNow: () => '2026-08-01T12:00:00.000Z',
  };
}

function createMockRefundStore(): IRefundStore & { refunds: RefundRequest[] } {
  const refunds: RefundRequest[] = [];
  return {
    refunds,
    save: vi.fn(async (r: RefundRequest) => {
      const idx = refunds.findIndex((x) => x.id === r.id);
      if (idx >= 0) refunds[idx] = r;
      else refunds.push(r);
    }),
    getById: vi.fn(async (id: string, buyerId: string) =>
      refunds.find((r) => r.id === id && r.buyerId === buyerId) ?? null),
    getByPurchaseId: vi.fn(async (purchaseId: string) =>
      refunds.find((r) => r.purchaseId === purchaseId) ?? null),
    getActiveByPurchaseId: vi.fn(async (purchaseId: string) =>
      refunds.find((r) => r.purchaseId === purchaseId &&
        (r.status === 'pending_confirmation' || r.status === 'submitted')) ?? null),
    getByBuyerId: vi.fn(async (buyerId: string) =>
      refunds.filter((r) => r.buyerId === buyerId)),
  };
}

function createMockPurchaseStore(purchases: Purchase[] = []): IPurchaseStore {
  return {
    save: vi.fn(async (p: Purchase) => {
      const idx = purchases.findIndex((x) => x.id === p.id);
      if (idx >= 0) purchases[idx] = p;
      else purchases.push(p);
    }),
    getById: vi.fn(async (id: string, buyerId: string) =>
      purchases.find((p) => p.id === id && p.buyerId === buyerId) ?? null),
    getByBuyerId: vi.fn(async (buyerId: string) =>
      purchases.filter((p) => p.buyerId === buyerId)),
    getByParticipationRequestId: vi.fn(async () => null),
  };
}

function createMockOhppClient() {
  return {
    sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-refund-1' })),
    getStatus: vi.fn(async () => ({ success: true, status: 'pending' as const })),
    cancelRequest: vi.fn(async () => ({ success: true })),
  } as unknown as OhppRequesterClient;
}

function createMockRegistrationStore(hasReg: boolean = true) {
  const creds: RegistrationCredentials = {
    challengeId: 'ch-1',
    resolverBaseUrl: 'http://resolver:8080',
    userId: 'user-1',
    accessToken: 'tok-1',
    registrationId: 'reg-1',
    createdAt: '2026-07-01T10:00:00Z',
  };
  return {
    store: vi.fn(async () => {}),
    get: vi.fn(async () => hasReg ? creds : null),
    getAll: vi.fn(async () => hasReg ? [creds] : []),
    delete: vi.fn(async () => {}),
    hasRegistration: vi.fn(async () => hasReg), getForAppUser: vi.fn(async () => hasReg ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null),
    getForAppUser: vi.fn(async () => hasReg ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null),
  };
}

describe('RefundService', () => {
  let refundStore: ReturnType<typeof createMockRefundStore>;
  let purchaseStore: IPurchaseStore;
  let ohppClient: ReturnType<typeof createMockOhppClient>;
  let registrationStore: ReturnType<typeof createMockRegistrationStore>;
  let clock: IClock;
  let service: RefundService;

  beforeEach(() => {
    refundStore = createMockRefundStore();
    purchaseStore = createMockPurchaseStore([makePurchase()]);
    ohppClient = createMockOhppClient();
    registrationStore = createMockRegistrationStore(true);
    clock = createMockClock();
    service = new RefundService(refundStore, purchaseStore, ohppClient, registrationStore, clock);
  });

  describe('requestRefund', () => {
    it('deliveredPurchase_sendsSelectRequest', async () => {
      const result = await service.requestRefund('purchase-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.refund).toBeDefined();
      expect(result.refund!.status).toBe('pending_confirmation');
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'select' }),
      );
    });

    it('undeliveredPurchase_returnsError', async () => {
      purchaseStore = createMockPurchaseStore([
        makePurchase({ status: 'processing' }),
      ]);
      service = new RefundService(refundStore, purchaseStore, ohppClient, registrationStore, clock);

      const result = await service.requestRefund('purchase-1', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('delivered');
    });

    it('alreadyHasActiveRefund_returnsError', async () => {
      // First refund
      await service.requestRefund('purchase-1', 'user-1');

      const result = await service.requestRefund('purchase-1', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('active refund');
    });

    it('beyond30Days_returnsError', async () => {
      purchaseStore = createMockPurchaseStore([
        makePurchase({ updatedAt: '2026-06-01T10:00:00Z' }),
      ]);
      service = new RefundService(refundStore, purchaseStore, ohppClient, registrationStore, clock);

      const result = await service.requestRefund('purchase-1', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('30 days');
    });
  });

  describe('resolveRefund', () => {
    it('validReason_createsRefundRequest', async () => {
      await service.requestRefund('purchase-1', 'user-1');
      const refund = refundStore.refunds[0];

      const result = await service.resolveRefund(
        refund.id, 'user-1', 'Item arrived damaged',
      );

      expect(result.success).toBe(true);
      expect(result.refund!.reason).toBe('Item arrived damaged');
      expect(result.refund!.status).toBe('submitted');
    });

    it('reasonTooShort_returnsError', async () => {
      await service.requestRefund('purchase-1', 'user-1');
      const refund = refundStore.refunds[0];

      const result = await service.resolveRefund(refund.id, 'user-1', 'Hi');

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('reasonTooLong_returnsError', async () => {
      await service.requestRefund('purchase-1', 'user-1');
      const refund = refundStore.refunds[0];

      const result = await service.resolveRefund(
        refund.id, 'user-1', 'x'.repeat(1001),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceed');
    });
  });
});
