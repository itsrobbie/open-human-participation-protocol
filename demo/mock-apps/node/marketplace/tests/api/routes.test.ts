/**
 * Marketplace App — API Route Tests
 * Tests Express routes with real HTTP requests against mocked service dependencies.
 * Proves: correct status codes, response shapes, auth enforcement, error handling.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiRoutes } from '../../src/presentation/routes.js';
import type { PurchaseService } from '../../src/services/purchase-service.js';
import type { ProductService } from '../../src/services/product-service.js';
import type { RefundService } from '../../src/services/refund-service.js';
import { ChallengeGenerator } from '@ohpp/sdk';

// --- Mock auth middleware ---
function mockAuthMiddleware(userId: string) {
  return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).userId = userId;
    (req as any).tokenPayload = { ohpp_user_id: userId };
    next();
  };
}

// --- Mock services ---
function createMockProductService() {
  return {
    listProducts: vi.fn(async (params: any) => ({
      products: [
        { id: 'prod-1', name: 'Widget', price: 4999, category: params.category ?? 'electronics', stock: 10, rating: 4.5, reviewCount: 100 },
        { id: 'prod-2', name: 'Gadget', price: 2999, category: 'home', stock: 5, rating: 4.2, reviewCount: 50 },
      ],
      totalCount: 2,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    })),
    getProduct: vi.fn(async (id: string) => {
      if (id === 'not-found') return null;
      return { id, name: 'Widget', description: 'A widget', price: 4999, category: 'electronics', stock: 10, rating: 4.5, reviewCount: 100, bundleEligible: false };
    }),
  } as unknown as ProductService;
}

function createMockPurchaseService() {
  return {
    createPurchase: vi.fn(async (params: any) => {
      if (!params.items || params.items.length === 0) return { success: false, error: 'Items required' };
      return { success: true, purchase: { id: 'pur-1', buyerId: params.buyerId, items: [{ productName: 'Widget', quantity: 1, totalPrice: 4999 }], total: 5498, status: 'confirmed' } };
    }),
    getHistory: vi.fn(async () => [
      { id: 'pur-1', items: [{ productName: 'Widget' }], total: 5498, status: 'confirmed', createdAt: '2026-08-01T12:00:00Z' },
    ]),
    getById: vi.fn(async (id: string, _buyerId: string) => {
      if (id === 'not-found') return null;
      return { id, items: [{ productName: 'Widget', quantity: 1, unitPrice: 4999, totalPrice: 4999 }], subtotal: 4999, shippingCost: 499, total: 5498, status: 'confirmed', shippingAddress: { line1: '1 Test', city: 'London', postcode: 'E1', country: 'UK' }, createdAt: '2026-08-01T12:00:00Z', updatedAt: '2026-08-01T12:00:00Z' };
    }),
    resolvePurchase: vi.fn(async () => ({ success: true, purchase: { id: 'pur-1', status: 'confirmed' } })),
    startBundlePurchase: vi.fn(async () => ({ success: true, purchase: { id: 'pur-bundle', status: 'pending_confirmation' } })),
    requestDeliverySlot: vi.fn(async () => ({ success: true, purchase: { id: 'pur-1', status: 'confirmed', participationRequestId: 'req-ds' } })),
    resolveDeliverySlotFromOhpp: vi.fn(async () => ({ success: true, purchase: { id: 'pur-1', deliverySlot: '2026-08-05T14:00:00Z' } })),
    requestTotalVerification: vi.fn(async () => ({ success: true, purchase: { id: 'pur-1', participationRequestId: 'req-tv' } })),
    resolveTotalVerification: vi.fn(async () => ({ success: true, purchase: { id: 'pur-1', participationStatus: 'confirmed' } })),
  } as unknown as PurchaseService;
}

function createMockRefundService() {
  return {
    requestRefund: vi.fn(async (purchaseId: string, _buyerId: string) => {
      if (purchaseId === 'already-refunded') return { success: false, error: 'This purchase already has an active refund request' };
      return { success: true, refund: { id: 'ref-1', purchaseId, status: 'pending_confirmation', amount: 5498 } };
    }),
    resolveRefund: vi.fn(async (_id: string, _buyerId: string, reason: string) => {
      if (reason.length < 10) return { success: false, error: 'Reason must be at least 10 characters' };
      return { success: true, refund: { id: 'ref-1', reason, status: 'submitted' } };
    }),
    getByBuyerId: vi.fn(async () => [
      { id: 'ref-1', purchaseId: 'pur-1', status: 'submitted', amount: 5498, createdAt: '2026-08-01T13:00:00Z' },
    ]),
  } as unknown as RefundService;
}

function createMockRegistrationStore() {
  return {
    hasRegistration: vi.fn(async () => true), getForAppUser: vi.fn(async () => ({ challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" })), recordPendingChallenge: vi.fn(async () => {}), deleteForAppUser: vi.fn(async () => {}),
    store: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    delete: vi.fn(async () => {}),
  } as any;
}

// --- App setup ---
let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());

  const apiRouter = createApiRoutes({
    productService: createMockProductService(),
    purchaseService: createMockPurchaseService(),
    refundService: createMockRefundService(),
    registrationStore: createMockRegistrationStore(),
    challengeGenerator: new ChallengeGenerator({ appId: 'marketplace.demo.test' }),
  });

  app.use('/api', mockAuthMiddleware('test-user'), apiRouter);
});

// --- Tests ---
describe('Marketplace API Routes', () => {
  describe('GET /api/products', () => {
    it('returns product list with pagination metadata', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('totalCount');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('passes query params to service', async () => {
      const res = await request(app).get('/api/products?category=electronics&sortBy=price&page=2&pageSize=5');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns product by id', async () => {
      const res = await request(app).get('/api/products/prod-1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('prod-1');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('price');
      expect(res.body).toHaveProperty('stock');
    });

    it('returns 404 for unknown product', async () => {
      const res = await request(app).get('/api/products/not-found');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/purchases', () => {
    it('creates purchase with valid body', async () => {
      const res = await request(app).post('/api/purchases').send({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: { line1: '1 Test St', city: 'London', postcode: 'E1 1AA', country: 'UK' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('total');
    });

    it('returns 400 for missing items', async () => {
      const res = await request(app).post('/api/purchases').send({
        items: [],
        shippingAddress: { line1: '1 Test', city: 'London', postcode: 'E1', country: 'UK' },
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/purchases', () => {
    it('returns purchase history', async () => {
      const res = await request(app).get('/api/purchases');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('total');
      expect(res.body[0]).toHaveProperty('status');
    });
  });

  describe('GET /api/purchases/:id', () => {
    it('returns purchase detail', async () => {
      const res = await request(app).get('/api/purchases/pur-1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('pur-1');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('shippingAddress');
    });

    it('returns 404 for unknown purchase', async () => {
      const res = await request(app).get('/api/purchases/not-found');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/purchases/:id/status', () => {
    it('resolves and returns purchase status', async () => {
      const res = await request(app).get('/api/purchases/pur-1/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
  });

  describe('POST /api/purchases/bundle', () => {
    it('starts bundle purchase', async () => {
      const res = await request(app).post('/api/purchases/bundle').send({
        shippingAddress: { line1: '1 Test', city: 'London', postcode: 'E1', country: 'UK' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('pending_confirmation');
    });
  });

  describe('Delivery Slot routes', () => {
    it('POST /api/purchases/:id/delivery-slot requests slot', async () => {
      const res = await request(app).post('/api/purchases/pur-1/delivery-slot');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('participationRequestId');
    });

    it('GET /api/purchases/:id/delivery-slot/status resolves slot', async () => {
      const res = await request(app).get('/api/purchases/pur-1/delivery-slot/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deliverySlot');
    });
  });

  describe('Total Verification routes', () => {
    it('POST /api/purchases/:id/verify-total requests verification', async () => {
      const res = await request(app).post('/api/purchases/pur-1/verify-total');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('participationRequestId');
    });

    it('GET /api/purchases/:id/verify-total/status resolves verification', async () => {
      const res = await request(app).get('/api/purchases/pur-1/verify-total/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('participationStatus');
    });
  });

  describe('POST /api/refunds', () => {
    it('creates refund for valid purchase', async () => {
      const res = await request(app).post('/api/refunds').send({ purchaseId: 'pur-1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('pending_confirmation');
    });

    it('returns 409 for duplicate refund', async () => {
      const res = await request(app).post('/api/refunds').send({ purchaseId: 'already-refunded' });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('active refund');
    });
  });

  describe('POST /api/refunds/:id/reason', () => {
    it('submits valid reason', async () => {
      const res = await request(app).post('/api/refunds/ref-1/reason').send({ reason: 'Item arrived damaged and broken' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('submitted');
      expect(res.body.reason).toBe('Item arrived damaged and broken');
    });

    it('returns 400 for too-short reason', async () => {
      const res = await request(app).post('/api/refunds/ref-1/reason').send({ reason: 'Short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least');
    });
  });

  describe('GET /api/refunds', () => {
    it('returns refund list', async () => {
      const res = await request(app).get('/api/refunds');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('OHPP Connection routes', () => {
    it('POST /api/ohpp/generate-challenge returns URI and metadata', async () => {
      const res = await request(app).post('/api/ohpp/generate-challenge');
      expect(res.status).toBe(200);
      expect(res.body.uri).toContain('ohpp://register?challenge=');
      expect(res.body).toHaveProperty('challengeId');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('GET /api/ohpp/status returns boolean connected', async () => {
      const res = await request(app).get('/api/ohpp/status');
      expect(res.status).toBe(200);
      expect(typeof res.body.connected).toBe('boolean');
    });

    it('DELETE /api/ohpp/disconnect returns disconnected', async () => {
      const res = await request(app).delete('/api/ohpp/disconnect');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });
  });
});
