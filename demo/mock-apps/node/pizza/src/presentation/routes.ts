import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../infrastructure/auth-middleware.js';
import type { OrderService } from '../services/order-service.js';
import type { StandardOrderService } from '../services/standard-order-service.js';
import type { OhppPizzaFlowController } from '../services/ohpp-pizza-flow-controller.js';
import type { IMenuStore } from '../domain/interfaces.js';
import type { PostgresRegistrationStore } from '../infrastructure/postgres-registration-store.js';
import { ChallengeGenerator } from '@ohpp/sdk';

export interface RoutesDeps {
  menuStore: IMenuStore;
  orderService: OrderService;
  standardOrderService: StandardOrderService;
  flowController: OhppPizzaFlowController;
  registrationStore: PostgresRegistrationStore;
  challengeGenerator: ChallengeGenerator;
}

export function createApiRoutes(deps: RoutesDeps): Router {
  const router = Router();

  function getUserId(req: Request): string {
    return (req as unknown as AuthenticatedRequest).userId;
  }

  // --- Menu ---
  router.get('/menu', async (_req, res: Response) => {
    const items = await deps.menuStore.getAll();
    res.json(items);
  });

  router.get('/menu/toppings', async (_req, res: Response) => {
    const toppings = await deps.menuStore.getToppings();
    res.json(toppings);
  });

  router.get('/menu/:id', async (req, res: Response) => {
    const item = await deps.menuStore.getById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }
    res.json(item);
  });

  // --- Orders (Standard) ---
  router.post('/orders', async (req, res: Response) => {
    const result = await deps.standardOrderService.checkout({
      userId: getUserId(req),
      items: req.body.items,
      deliveryAddress: req.body.deliveryAddress,
      specialInstructions: req.body.specialInstructions,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.order);
  });

  router.get('/orders', async (req, res: Response) => {
    const orders = await deps.orderService.getHistory(getUserId(req));
    res.json(orders);
  });

  router.get('/orders/:id', async (req, res: Response) => {
    const order = await deps.orderService.getById(req.params.id, getUserId(req));
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  });

  router.get('/orders/:id/status', async (req, res: Response) => {
    const result = await deps.standardOrderService.resolveOrder(req.params.id, getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.order);
  });

  router.post('/orders/:id/cancel', async (req, res: Response) => {
    const result = await deps.orderService.cancel(req.params.id, getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.order);
  });

  // --- OHPP Pizza Flow ---
  router.post('/orders/ohpp-pizza', async (req, res: Response) => {
    const result = await deps.flowController.startFlow(getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ flow: result.flow });
  });

  router.get('/orders/ohpp-pizza/status', async (req, res: Response) => {
    const result = await deps.flowController.getFlowStatus(getUserId(req));
    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ flow: result.flow });
  });

  router.post('/orders/ohpp-pizza/:flowId/advance', async (req, res: Response) => {
    const result = await deps.flowController.advanceFlow(req.params.flowId, getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ flow: result.flow, order: result.order });
  });

  router.post('/orders/ohpp-pizza/:flowId/cancel', async (req, res: Response) => {
    const result = await deps.flowController.cancelFlow(req.params.flowId, getUserId(req));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ flow: result.flow });
  });

  // --- OHPP Connection ---
  router.post('/ohpp/generate-challenge', async (req, res: Response) => {
    const challenge = deps.challengeGenerator.createChallenge(10 * 60 * 1000);
    const uri = ChallengeGenerator.buildChallengeUri(challenge);
    // Record which app user generated this challenge so we can link them on callback
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
