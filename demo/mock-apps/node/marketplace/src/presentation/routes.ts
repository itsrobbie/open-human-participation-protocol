import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../infrastructure/auth-middleware.js';
import type { PurchaseService } from '../services/purchase-service.js';
import type { ProductService } from '../services/product-service.js';
import type { RefundService } from '../services/refund-service.js';
import type { PostgresRegistrationStore } from '../infrastructure/postgres-registration-store.js';
import type { ProductCategory } from '../domain/types.js';
import { ChallengeGenerator } from '@ohpp/sdk';

export interface RoutesDeps {
  productService: ProductService;
  purchaseService: PurchaseService;
  refundService: RefundService;
  registrationStore: PostgresRegistrationStore;
  challengeGenerator: ChallengeGenerator;
}

export function createApiRoutes(deps: RoutesDeps): Router {
  const router = Router();

  function getUserId(req: Request): string {
    return (req as unknown as AuthenticatedRequest).userId;
  }

  // --- Products ---
  router.get('/products', async (req, res: Response) => {
    const result = await deps.productService.listProducts({
      category: req.query.category as ProductCategory | undefined,
      sortBy: req.query.sortBy as 'price' | 'rating' | 'newest' | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
    });
    res.json(result);
  });

  router.get('/products/:id', async (req, res: Response) => {
    const product = await deps.productService.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(product);
  });

  // --- Purchases ---
  router.post('/purchases', async (req, res: Response) => {
    const result = await deps.purchaseService.createPurchase({
      buyerId: getUserId(req),
      items: req.body.items,
      shippingAddress: req.body.shippingAddress,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  router.get('/purchases', async (req, res: Response) => {
    const purchases = await deps.purchaseService.getHistory(getUserId(req));
    res.json(purchases);
  });

  router.get('/purchases/:id', async (req, res: Response) => {
    const purchase = await deps.purchaseService.getById(req.params.id, getUserId(req));
    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }
    res.json(purchase);
  });

  router.get('/purchases/:id/status', async (req, res: Response) => {
    const result = await deps.purchaseService.resolvePurchase(req.params.id, getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  // --- Bundles ---
  router.post('/purchases/bundle', async (req, res: Response) => {
    const result = await deps.purchaseService.startBundlePurchase(
      getUserId(req),
      req.body.shippingAddress,
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  // --- Delivery Slot ---
  router.post('/purchases/:id/delivery-slot', async (req, res: Response) => {
    const result = await deps.purchaseService.requestDeliverySlot(
      req.params.id,
      getUserId(req),
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  router.get('/purchases/:id/delivery-slot/status', async (req, res: Response) => {
    const result = await deps.purchaseService.resolveDeliverySlotFromOhpp(
      req.params.id,
      getUserId(req),
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  // --- Total Verification ---
  router.post('/purchases/:id/verify-total', async (req, res: Response) => {
    const result = await deps.purchaseService.requestTotalVerification(
      req.params.id,
      getUserId(req),
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  router.get('/purchases/:id/verify-total/status', async (req, res: Response) => {
    const result = await deps.purchaseService.resolveTotalVerification(
      req.params.id,
      getUserId(req),
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.purchase);
  });

  // --- Refunds ---
  router.post('/refunds', async (req, res: Response) => {
    const result = await deps.refundService.requestRefund(
      req.body.purchaseId,
      getUserId(req),
    );
    if (!result.success) {
      const status = result.error?.includes('active refund') ? 409 : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.refund);
  });

  router.post('/refunds/:id/reason', async (req, res: Response) => {
    const result = await deps.refundService.resolveRefund(
      req.params.id,
      getUserId(req),
      req.body.reason,
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.refund);
  });

  router.get('/refunds', async (req, res: Response) => {
    const refunds = await deps.refundService.getByBuyerId(getUserId(req));
    res.json(refunds);
  });

  // --- OHPP Connection ---
  router.post('/ohpp/generate-challenge', async (req, res: Response) => {
    const challenge = deps.challengeGenerator.createChallenge(10 * 60 * 1000);
    const uri = ChallengeGenerator.buildChallengeUri(challenge);
    await deps.registrationStore.recordPendingChallenge(challenge.challengeId, getUserId(req));
    res.json({ uri, challengeId: challenge.challengeId, expiresAt: challenge.expiresAt });
  });

  router.get('/ohpp/status', async (req, res: Response) => {
    const connected = await deps.registrationStore.hasRegistration(getUserId(req));
    res.json({ connected });
  });

  router.delete('/ohpp/disconnect', async (req, res: Response) => {
    await deps.registrationStore.deleteForAppUser(getUserId(req));
    res.json({ connected: false });
  });

  return router;
}
