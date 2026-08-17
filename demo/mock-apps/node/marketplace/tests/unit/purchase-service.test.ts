import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseService } from '../../src/services/purchase-service.js';
import type { IPurchaseStore, IProductStore, IClock, IRegistrationChecker } from '../../src/domain/interfaces.js';
import type { Product, Purchase, ShippingAddress } from '../../src/domain/types.js';
import { HIGH_VALUE_THRESHOLD, SHIPPING_COST } from '../../src/domain/types.js';
import type { OhppRequesterClient, CredentialStore, SendResult, RegistrationCredentials } from '@ohpp/sdk';

// --- Test doubles ---

function createMockProductStore(products: Product[] = []): IProductStore {
  return {
    getAll: vi.fn(async () => products),
    getById: vi.fn(async (id: string) => products.find((p) => p.id === id) ?? null),
    getByCategory: vi.fn(async (cat: string) => products.filter((p) => p.category === cat)),
    decrementStock: vi.fn(async (_id: string, _qty: number) => true),
  };
}

function createMockPurchaseStore(): IPurchaseStore {
  const purchases: Purchase[] = [];
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
    getByParticipationRequestId: vi.fn(async (reqId: string) =>
      purchases.find((p) => p.participationRequestId === reqId) ?? null),
  };
}

function createMockClock(): IClock {
  return {
    now: () => new Date('2026-08-01T12:00:00Z'),
    isoNow: () => '2026-08-01T12:00:00.000Z',
  };
}

function createMockOhppClient(sendResult: SendResult = { success: true, requestId: 'req-123' }): OhppRequesterClient {
  return {
    sendRequest: vi.fn(async () => sendResult),
    getStatus: vi.fn(async () => ({ success: true, status: 'pending' as const })),
    cancelRequest: vi.fn(async () => ({ success: true })),
  } as unknown as OhppRequesterClient;
}

function createMockRegistrationStore(hasReg: boolean = true): CredentialStore & { hasRegistration: (userId: string) => Promise<boolean>; getForAppUser: (userId: string) => Promise<RegistrationCredentials | null> } {
  const creds: RegistrationCredentials = {
    challengeId: 'ch-1',
    resolverBaseUrl: 'http://resolver:8080',
    userId: 'resolver-user-id',
    accessToken: 'tok-1',
    registrationId: 'reg-1',
    createdAt: '2026-07-01T10:00:00Z',
  };
  return {
    store: vi.fn(async () => {}),
    get: vi.fn(async () => hasReg ? creds : null),
    getAll: vi.fn(async () => hasReg ? [creds] : []),
    delete: vi.fn(async () => {}),
    hasRegistration: vi.fn(async () => hasReg),
    getForAppUser: vi.fn(async () => hasReg ? creds : null),
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sellerId: 'seller-1',
    name: 'Test Product',
    description: 'A test product',
    price: 4999,
    category: 'electronics',
    stock: 10,
    rating: 4.5,
    reviewCount: 100,
    bundleEligible: false,
    createdAt: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function makeAddress(): ShippingAddress {
  return { line1: '123 Test St', city: 'London', postcode: 'E1 1AA', country: 'UK' };
}

describe('PurchaseService', () => {
  let purchaseStore: IPurchaseStore;
  let productStore: IProductStore;
  let clock: IClock;
  let ohppClient: OhppRequesterClient;
  let registrationStore: ReturnType<typeof createMockRegistrationStore>;
  let service: PurchaseService;

  beforeEach(() => {
    const products = [
      makeProduct({ id: 'prod-1', price: 4999, stock: 10 }),
      makeProduct({ id: 'prod-expensive', price: 15000, stock: 5 }),
      makeProduct({ id: 'prod-oos', price: 2999, stock: 0 }),
      makeProduct({ id: 'prod-low', price: 1999, stock: 1 }),
    ];
    productStore = createMockProductStore(products);
    purchaseStore = createMockPurchaseStore();
    clock = createMockClock();
    ohppClient = createMockOhppClient();
    registrationStore = createMockRegistrationStore(true);
    service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);
  });

  describe('createPurchase', () => {
    it('standardAmount_sendsSelectRequest', async () => {
      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(true);
      expect(result.purchase).toBeDefined();
      expect(result.purchase!.status).toBe('pending_confirmation');
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'select' }),
      );
    });

    it('highValue_sendsSignatureRequest', async () => {
      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-expensive', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(true);
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'signature' }),
      );
    });

    it('noOhpp_confirmsDirectly', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(true);
      expect(result.purchase!.status).toBe('confirmed');
      expect(ohppClient.sendRequest).not.toHaveBeenCalled();
    });

    it('outOfStock_returnsError', async () => {
      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-oos', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('out of stock');
    });

    it('exceedsStock_returnsError', async () => {
      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-low', quantity: 5 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('stock');
    });

    it('confirmPurchase_decrementsStock', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 2 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(true);
      expect(productStore.decrementStock).toHaveBeenCalledWith('prod-1', 2);
    });

    it('cancelPurchase_doesNotDecrementStock', async () => {
      // OHPP connected but request fails
      ohppClient = createMockOhppClient({ success: false, error: 'Resolver down' });
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(productStore.decrementStock).not.toHaveBeenCalled();
    });
  });

  describe('resolveBundle', () => {
    it('validSelection_createsPurchase', async () => {
      const bundleProducts = [
        makeProduct({ id: 'bp-1', price: 999, bundleEligible: true }),
        makeProduct({ id: 'bp-2', price: 1499, bundleEligible: true }),
        makeProduct({ id: 'bp-3', price: 799, bundleEligible: true }),
      ];
      productStore = createMockProductStore(bundleProducts);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.resolveBundle({
        buyerId: 'user-1',
        selectedProductIds: ['bp-1', 'bp-2'],
        minItems: 2,
        maxItems: 3,
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(true);
      expect(result.purchase).toBeDefined();
      expect(result.purchase!.items).toHaveLength(2);
    });

    it('tooFewItems_returnsError', async () => {
      const bundleProducts = [makeProduct({ id: 'bp-1', bundleEligible: true })];
      productStore = createMockProductStore(bundleProducts);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.resolveBundle({
        buyerId: 'user-1',
        selectedProductIds: ['bp-1'],
        minItems: 2,
        maxItems: 3,
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('tooManyItems_returnsError', async () => {
      const bundleProducts = [
        makeProduct({ id: 'bp-1', bundleEligible: true }),
        makeProduct({ id: 'bp-2', bundleEligible: true }),
        makeProduct({ id: 'bp-3', bundleEligible: true }),
        makeProduct({ id: 'bp-4', bundleEligible: true }),
      ];
      productStore = createMockProductStore(bundleProducts);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.resolveBundle({
        buyerId: 'user-1',
        selectedProductIds: ['bp-1', 'bp-2', 'bp-3', 'bp-4'],
        minItems: 2,
        maxItems: 3,
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at most 3');
    });

    it('invalidItemKey_returnsError', async () => {
      const bundleProducts = [makeProduct({ id: 'bp-1', bundleEligible: true })];
      productStore = createMockProductStore(bundleProducts);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.resolveBundle({
        buyerId: 'user-1',
        selectedProductIds: ['bp-1', 'nonexistent'],
        minItems: 2,
        maxItems: 3,
        shippingAddress: makeAddress(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('resolveDeliverySlot', () => {
    it('validDatetime_storesSlot', async () => {
      // Create a purchase first
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });
      const purchaseId = createResult.purchase!.id;

      const result = await service.resolveDeliverySlot(
        purchaseId, 'user-1', '2026-08-05T14:00:00Z',
      );

      expect(result.success).toBe(true);
      expect(result.purchase!.deliverySlot).toBe('2026-08-05T14:00:00Z');
    });

    it('pastDatetime_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.resolveDeliverySlot(
        createResult.purchase!.id, 'user-1', '2026-07-01T14:00:00Z',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('outsideBusinessHours_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.resolveDeliverySlot(
        createResult.purchase!.id, 'user-1', '2026-08-05T22:00:00Z',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('business hours');
    });

    it('beyond14Days_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.resolveDeliverySlot(
        createResult.purchase!.id, 'user-1', '2026-09-01T14:00:00Z',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('14 days');
    });
  });

  describe('startBundlePurchase', () => {
    it('sendsMultiselectRequest_withBundleEligibleProducts', async () => {
      const bundleProducts = [
        makeProduct({ id: 'bp-1', price: 999, bundleEligible: true, stock: 5 }),
        makeProduct({ id: 'bp-2', price: 1499, bundleEligible: true, stock: 3 }),
        makeProduct({ id: 'bp-3', price: 799, bundleEligible: true, stock: 10 }),
        makeProduct({ id: 'non-bundle', price: 5000, bundleEligible: false, stock: 8 }),
      ];
      productStore = createMockProductStore(bundleProducts);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.startBundlePurchase('user-1', makeAddress());

      expect(result.success).toBe(true);
      expect(result.purchase!.status).toBe('pending_confirmation');
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'multiselect',
          options: expect.arrayContaining([
            expect.objectContaining({ key: 'bp-1' }),
            expect.objectContaining({ key: 'bp-2' }),
            expect.objectContaining({ key: 'bp-3' }),
          ]),
        }),
      );
      // non-bundle product should not be in options
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.not.arrayContaining([
            expect.objectContaining({ key: 'non-bundle' }),
          ]),
        }),
      );
    });

    it('noOhpp_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.startBundlePurchase('user-1', makeAddress());

      expect(result.success).toBe(false);
      expect(result.error).toContain('OHPP connection required');
    });

    it('notEnoughBundleProducts_returnsError', async () => {
      const products = [
        makeProduct({ id: 'bp-1', bundleEligible: true, stock: 5 }),
        makeProduct({ id: 'non-bundle', bundleEligible: false, stock: 8 }),
      ];
      productStore = createMockProductStore(products);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.startBundlePurchase('user-1', makeAddress());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough bundle-eligible');
    });
  });

  describe('requestDeliverySlot', () => {
    it('sendsDatetimeRequest_forConfirmedPurchase', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      // Now reconnect OHPP and request delivery slot
      registrationStore = createMockRegistrationStore(true);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.requestDeliverySlot(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(true);
      expect(result.purchase!.participationRequestId).toBe('req-123');
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'datetime' }),
      );
    });

    it('notConfirmed_returnsError', async () => {
      // Create a pending purchase (OHPP connected)
      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.requestDeliverySlot(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('confirmed purchases');
    });

    it('noOhpp_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.requestDeliverySlot(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OHPP connection required');
    });
  });

  describe('requestTotalVerification', () => {
    it('sendsNumberRequest_forConfirmedPurchase', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      // Reconnect OHPP
      registrationStore = createMockRegistrationStore(true);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const result = await service.requestTotalVerification(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(true);
      expect(ohppClient.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'number', keyboard: 'decimal' }),
      );
    });

    it('notConfirmed_returnsError', async () => {
      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      const result = await service.requestTotalVerification(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('confirmed purchases');
    });
  });

  describe('resolveTotalVerification', () => {
    it('matchesExpected_confirmsOrder', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });
      const purchase = createResult.purchase!;
      const expectedTotal = (purchase.total / 100).toFixed(2);

      // Now set up the OHPP mock to return resolved with matching value
      registrationStore = createMockRegistrationStore(true);
      ohppClient = {
        ...ohppClient,
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-verify' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved' as const, value: expectedTotal })),
      } as unknown as OhppRequesterClient;
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      // Request verification (sets participationRequestId)
      await service.requestTotalVerification(purchase.id, 'user-1');

      // Resolve it
      const result = await service.resolveTotalVerification(purchase.id, 'user-1');

      expect(result.success).toBe(true);
      expect(result.purchase!.participationStatus).toBe('confirmed');
    });

    it('mismatch_flagsForReview', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      registrationStore = createMockRegistrationStore(true);
      ohppClient = {
        ...ohppClient,
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-verify' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved' as const, value: '999.99' })),
      } as unknown as OhppRequesterClient;
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      await service.requestTotalVerification(createResult.purchase!.id, 'user-1');
      const result = await service.resolveTotalVerification(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('mismatch');
    });

    it('nonNumericValue_returnsError', async () => {
      registrationStore = createMockRegistrationStore(false);
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      const createResult = await service.createPurchase({
        buyerId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: makeAddress(),
      });

      registrationStore = createMockRegistrationStore(true);
      ohppClient = {
        ...ohppClient,
        sendRequest: vi.fn(async () => ({ success: true, requestId: 'req-verify' })),
        getStatus: vi.fn(async () => ({ success: true, status: 'resolved' as const, value: 'not-a-number' })),
      } as unknown as OhppRequesterClient;
      service = new PurchaseService(purchaseStore, productStore, ohppClient, registrationStore, clock);

      await service.requestTotalVerification(createResult.purchase!.id, 'user-1');
      const result = await service.resolveTotalVerification(createResult.purchase!.id, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Non-numeric');
    });
  });
});
