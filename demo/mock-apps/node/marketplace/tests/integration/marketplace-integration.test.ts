/**
 * Marketplace App Integration Tests.
 * Tests service interactions end-to-end with in-memory stores.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseService } from '../../src/services/purchase-service.js';
import { RefundService } from '../../src/services/refund-service.js';
import type { IPurchaseStore, IProductStore, IRefundStore, IClock, IRegistrationChecker } from '../../src/domain/interfaces.js';
import type { Product, Purchase, RefundRequest, ShippingAddress } from '../../src/domain/types.js';
import type { OhppRequesterClient } from '@ohpp/sdk';

function createInMemoryProductStore(products: Product[]): IProductStore {
  return {
    getAll: vi.fn(async () => products),
    getById: vi.fn(async (id: string) => products.find((p) => p.id === id) ?? null),
    getByCategory: vi.fn(async (cat: string) => products.filter((p) => p.category === cat)),
    decrementStock: vi.fn(async (id: string, qty: number) => {
      const p = products.find((x) => x.id === id);
      if (p && p.stock >= qty) { p.stock -= qty; return true; }
      return false;
    }),
  };
}

function createInMemoryPurchaseStore(): IPurchaseStore {
  const purchases: Purchase[] = [];
  return {
    save: vi.fn(async (p: Purchase) => {
      const idx = purchases.findIndex((x) => x.id === p.id);
      if (idx >= 0) purchases[idx] = p; else purchases.push(p);
    }),
    getById: vi.fn(async (id: string, buyerId: string) =>
      purchases.find((p) => p.id === id && p.buyerId === buyerId) ?? null),
    getByBuyerId: vi.fn(async (buyerId: string) => purchases.filter((p) => p.buyerId === buyerId)),
    getByParticipationRequestId: vi.fn(async (reqId: string) =>
      purchases.find((p) => p.participationRequestId === reqId) ?? null),
  };
}

function createInMemoryRefundStore(): IRefundStore {
  const refunds: RefundRequest[] = [];
  return {
    save: vi.fn(async (r: RefundRequest) => {
      const idx = refunds.findIndex((x) => x.id === r.id);
      if (idx >= 0) refunds[idx] = r; else refunds.push(r);
    }),
    getById: vi.fn(async (id: string, buyerId: string) =>
      refunds.find((r) => r.id === id && r.buyerId === buyerId) ?? null),
    getByPurchaseId: vi.fn(async (purchaseId: string) =>
      refunds.find((r) => r.purchaseId === purchaseId) ?? null),
    getActiveByPurchaseId: vi.fn(async (purchaseId: string) =>
      refunds.find((r) => r.purchaseId === purchaseId && ['pending_confirmation', 'submitted'].includes(r.status)) ?? null),
    getByBuyerId: vi.fn(async (buyerId: string) => refunds.filter((r) => r.buyerId === buyerId)),
  };
}

function createMockClock(): IClock {
  return { now: () => new Date('2026-08-01T12:00:00Z'), isoNow: () => '2026-08-01T12:00:00.000Z' };
}

function createMockRegistrationChecker(hasReg: boolean): IRegistrationChecker {
  return { hasRegistration: vi.fn(async () => hasReg), getForAppUser: vi.fn(async () => hasReg ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null) };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1', sellerId: 's1', name: 'Widget', description: 'A widget', price: 4999,
    category: 'electronics', stock: 10, rating: 4.5, reviewCount: 100, bundleEligible: false,
    createdAt: '2026-01-01T10:00:00Z', ...overrides,
  };
}

function makeAddress(): ShippingAddress {
  return { line1: '1 Test St', city: 'London', postcode: 'E1 1AA', country: 'UK' };
}

describe('Marketplace Integration', () => {
  describe('Standard Purchase Full Flow', () => {
    it('confirmToCompleted', async () => {
      const products = [makeProduct({ id: 'prod-1', price: 4999, stock: 10 })];
      const productStore = createInMemoryProductStore(products);
      const purchaseStore = createInMemoryPurchaseStore();
      const clock = createMockClock();
      const regChecker = createMockRegistrationChecker(true);

      const ohppClient = {
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-int-1' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved', selectedOption: 'confirm' })),
        cancelRequest: vi.fn(async () => ({ success: true })),
      } as unknown as OhppRequesterClient;

      const service = new PurchaseService(purchaseStore, productStore, ohppClient, regChecker, clock);

      // Create purchase
      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });
      expect(createResult.success).toBe(true);
      expect(createResult.purchase!.status).toBe('pending_confirmation');

      // Resolve
      const resolveResult = await service.resolvePurchase(createResult.purchase!.id, 'user-1');
      expect(resolveResult.success).toBe(true);
      expect(resolveResult.purchase!.status).toBe('confirmed');
      expect(productStore.decrementStock).toHaveBeenCalledWith('prod-1', 1);
    });
  });

  describe('High-Value Signature Flow', () => {
    it('signatureFlow_confirmToCompleted', async () => {
      const products = [makeProduct({ id: 'expensive', price: 20000, stock: 5 })];
      const productStore = createInMemoryProductStore(products);
      const purchaseStore = createInMemoryPurchaseStore();
      const clock = createMockClock();
      const regChecker = createMockRegistrationChecker(true);

      const ohppClient = {
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-sig-1' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved', value: 'sig-proof-abc' })),
        cancelRequest: vi.fn(async () => ({ success: true })),
      } as unknown as OhppRequesterClient;

      const service = new PurchaseService(purchaseStore, productStore, ohppClient, regChecker, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'expensive', quantity: 1 }],
        shippingAddress: makeAddress(),
      });
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ type: 'signature' }));

      const resolveResult = await service.resolvePurchase(createResult.purchase!.id, 'user-1');
      expect(resolveResult.purchase!.status).toBe('confirmed');
      expect(resolveResult.purchase!.signatureAttestationId).toBeTruthy();
    });
  });

  describe('Bundle Multiselect Flow', () => {
    it('multiselectFlow_createsPurchaseWithItems', async () => {
      const products = [
        makeProduct({ id: 'b1', price: 999, bundleEligible: true, stock: 5 }),
        makeProduct({ id: 'b2', price: 1499, bundleEligible: true, stock: 3 }),
        makeProduct({ id: 'b3', price: 799, bundleEligible: true, stock: 10 }),
      ];
      const productStore = createInMemoryProductStore(products);
      const purchaseStore = createInMemoryPurchaseStore();
      const clock = createMockClock();
      const regChecker = createMockRegistrationChecker(true);

      const ohppClient = {
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-bundle-1' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved', selectedOptions: ['b1', 'b2'] })),
        cancelRequest: vi.fn(async () => ({ success: true })),
      } as unknown as OhppRequesterClient;

      const service = new PurchaseService(purchaseStore, productStore, ohppClient, regChecker, clock);

      // Start bundle
      const startResult = await service.startBundlePurchase('user-1', makeAddress());
      expect(startResult.success).toBe(true);
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(expect.objectContaining({ type: 'multiselect' }));

      // Resolve
      const resolveResult = await service.resolvePurchase(startResult.purchase!.id, 'user-1');
      expect(resolveResult.success).toBe(true);
      expect(resolveResult.purchase!.items).toHaveLength(2);
      expect(resolveResult.purchase!.status).toBe('confirmed');
    });
  });

  describe('Refund Flow', () => {
    it('confirmThenReason_createsRefundRequest', async () => {
      const products = [makeProduct({ id: 'prod-1', price: 4999, stock: 10 })];
      const productStore = createInMemoryProductStore(products);
      const purchaseStore = createInMemoryPurchaseStore();
      const refundStore = createInMemoryRefundStore();
      const clock = createMockClock();
      const regChecker = createMockRegistrationChecker(true);

      const ohppClient = {
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-refund-1' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved', selectedOption: 'confirm' })),
        cancelRequest: vi.fn(async () => ({ success: true })),
      } as unknown as OhppRequesterClient;

      // Create and manually confirm a purchase, then mark delivered
      const purchaseService = new PurchaseService(purchaseStore, productStore, ohppClient, regChecker, clock);
      const refundService = new RefundService(refundStore, purchaseStore, ohppClient, regChecker, clock);

      // Create directly as confirmed (no OHPP for setup)
      const noOhppChecker = createMockRegistrationChecker(false);
      const setupService = new PurchaseService(purchaseStore, productStore, ohppClient, noOhppChecker, clock);
      const createResult = await setupService.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      // Manually set to delivered
      const purchase = createResult.purchase!;
      purchase.status = 'delivered';
      purchase.updatedAt = '2026-07-28T10:00:00Z'; // within 30-day window
      await purchaseStore.save(purchase);

      // Request refund
      const refundResult = await refundService.requestRefund(purchase.id, 'user-1');
      expect(refundResult.success).toBe(true);
      expect(refundResult.refund!.status).toBe('pending_confirmation');

      // Submit reason
      const reasonResult = await refundService.resolveRefund(refundResult.refund!.id, 'user-1', 'Item arrived damaged and unusable');
      expect(reasonResult.success).toBe(true);
      expect(reasonResult.refund!.status).toBe('submitted');
      expect(reasonResult.refund!.reason).toBe('Item arrived damaged and unusable');
    });
  });
});
