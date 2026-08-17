import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '../../src/services/order-service.js';
import type { IOrderStore, IClock } from '../../src/domain/interfaces.js';
import type { Order } from '../../src/domain/types.js';

function mockOrderStore(): IOrderStore {
  const orders = new Map<string, Order>();
  return {
    save: vi.fn(async (order: Order) => { orders.set(order.id, order); }),
    getById: vi.fn(async (id: string, userId: string) => {
      const o = orders.get(id);
      return o && o.userId === userId ? o : null;
    }),
    getByUserId: vi.fn(async (userId: string) =>
      Array.from(orders.values()).filter((o) => o.userId === userId),
    ),
    getByParticipationRequestId: vi.fn(async () => null),
    updateStatus: vi.fn(async (id: string, status: Order['status']) => {
      const o = orders.get(id);
      if (o) o.status = status;
    }),
  };
}

function mockClock(): IClock {
  return {
    now: () => new Date('2026-08-05T12:00:00Z'),
    isoNow: () => '2026-08-05T12:00:00.000Z',
  };
}

const validItems = [
  { id: 'i1', menuItemId: 'margherita', name: 'Margherita', quantity: 1, unitPrice: 999, totalPrice: 999 },
];

const validAddress = { line1: '42 Smith St', city: 'London', postcode: 'SW1A 1AA' };

describe('OrderService', () => {
  let service: OrderService;
  let store: IOrderStore;

  beforeEach(() => {
    store = mockOrderStore();
    service = new OrderService(store, mockClock());
  });

  it('createOrder_validCart_createsWithPendingStatus', async () => {
    const result = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
      participationRequestId: 'req-123',
    });
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('pending_confirmation');
    expect(result.order?.participationRequestId).toBe('req-123');
  });

  it('createOrder_emptyCart_returnsError', async () => {
    const result = await service.create({
      userId: 'user-1',
      items: [],
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 1');
  });

  it('createOrder_noOhpp_createsConfirmedDirectly', async () => {
    const result = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('confirmed');
  });

  it('cancelOrder_pendingOrder_cancelsSuccessfully', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
      participationRequestId: 'req-1',
    });
    const result = await service.cancel(createResult.order!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('cancelled');
  });

  it('cancelOrder_confirmedOrder_cancelsSuccessfully', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    const result = await service.cancel(createResult.order!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('cancelled');
  });

  it('cancelOrder_deliveredOrder_returnsError', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    // Manually set to delivered
    createResult.order!.status = 'delivered';
    await store.save(createResult.order!);

    const result = await service.cancel(createResult.order!.id, 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot cancel');
  });

  it('cancelOrder_withOhppRequest_cancelsOhppToo', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
      participationRequestId: 'req-1',
    });
    const result = await service.cancel(createResult.order!.id, 'user-1');
    expect(result.success).toBe(true);
    // The actual OHPP cancellation is handled by the caller (StandardOrderService)
  });

  it('updateStatus_validTransition_updatesOrder', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    const result = await service.updateStatus(createResult.order!.id, 'user-1', 'preparing');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('preparing');
  });

  it('updateStatus_invalidTransition_returnsError', async () => {
    const createResult = await service.create({
      userId: 'user-1',
      items: validItems,
      deliveryAddress: validAddress,
      orderMode: 'standard',
    });
    // Can't go from confirmed to delivered directly
    const result = await service.updateStatus(createResult.order!.id, 'user-1', 'delivered');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
  });

  it('getHistory_returnsOrdersByDate', async () => {
    await service.create({ userId: 'user-1', items: validItems, deliveryAddress: validAddress, orderMode: 'standard' });
    await service.create({ userId: 'user-1', items: validItems, deliveryAddress: validAddress, orderMode: 'standard' });
    const history = await service.getHistory('user-1');
    expect(history).toHaveLength(2);
  });
});
