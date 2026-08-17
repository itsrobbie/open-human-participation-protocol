import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandardOrderService } from '../../src/services/standard-order-service.js';
import { OrderService } from '../../src/services/order-service.js';
import type { IOrderStore, IClock } from '../../src/domain/interfaces.js';
import type { Order } from '../../src/domain/types.js';
import type { OhppRequesterClient } from '@ohpp/sdk';
import type { PostgresRegistrationStore } from '../../src/infrastructure/postgres-registration-store.js';

function mockOrderStore(): IOrderStore {
  const orders = new Map<string, Order>();
  return {
    save: vi.fn(async (order: Order) => { orders.set(order.id, order); }),
    getById: vi.fn(async (id: string, userId: string) => {
      const o = orders.get(id); return o && o.userId === userId ? o : null;
    }),
    getByUserId: vi.fn(async () => []),
    getByParticipationRequestId: vi.fn(async () => null),
    updateStatus: vi.fn(),
  };
}

function mockClock(): IClock {
  return { now: () => new Date('2026-08-05T12:00:00Z'), isoNow: () => '2026-08-05T12:00:00.000Z' };
}

function mockOhppClient(sendSuccess = true): OhppRequesterClient {
  return {
    sendRequest: vi.fn().mockResolvedValue(
      sendSuccess ? { success: true, requestId: 'req-123' } : { success: false, error: 'Resolver error' },
    ),
    getStatus: vi.fn().mockResolvedValue({ success: true, status: 'pending' }),
    cancelRequest: vi.fn().mockResolvedValue({ success: true }),
  } as unknown as OhppRequesterClient;
}

function mockRegistrationStore(connected = true): PostgresRegistrationStore {
  return {
    hasRegistration: vi.fn().mockResolvedValue(connected), getForAppUser: vi.fn().mockResolvedValue(connected ? { challengeId: "ch", resolverBaseUrl: "http://resolver:8080", userId: "resolver-user-id", accessToken: "tok", registrationId: "r1", createdAt: "2026-07-01T10:00:00Z" } : null),
    get: vi.fn().mockResolvedValue(connected ? { accessToken: 'token' } : null),
    getAll: vi.fn().mockResolvedValue([]),
    store: vi.fn(),
    delete: vi.fn(),
  } as unknown as PostgresRegistrationStore;
}

const validItems = [{ id: 'i1', menuItemId: 'margherita', name: 'Margherita', quantity: 1, unitPrice: 999, totalPrice: 999 }];
const validAddress = { line1: '42 Smith St', city: 'London', postcode: 'SW1A 1AA' };

describe('StandardOrderService', () => {
  let service: StandardOrderService;
  let ohppClient: OhppRequesterClient;

  beforeEach(() => {
    ohppClient = mockOhppClient();
    const store = mockOrderStore();
    const orderService = new OrderService(store, mockClock());
    service = new StandardOrderService(orderService, ohppClient, mockRegistrationStore());
  });

  it('checkout_ohppConnected_sendsSelectRequest', async () => {
    const result = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: validAddress });
    expect(result.success).toBe(true);
    expect(ohppClient.sendRequest).toHaveBeenCalledTimes(1);
    expect(result.order?.status).toBe('pending_confirmation');
    expect(result.order?.participationRequestId).toBe('req-123');
  });

  it('checkout_ohppNotConnected_confirmsDirectly', async () => {
    const store = mockOrderStore();
    const orderService = new OrderService(store, mockClock());
    service = new StandardOrderService(orderService, mockOhppClient(), mockRegistrationStore(false));

    const result = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: validAddress });
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('confirmed');
  });

  it('checkout_invalidAddress_returnsError', async () => {
    const result = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: { line1: '', city: '', postcode: '' } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('address');
  });

  it('resolveOrder_confirmOption_advancesToConfirmed', async () => {
    const client = mockOhppClient();
    (client.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'resolved', selectedOption: 'confirm' });
    const store = mockOrderStore();
    const orderService = new OrderService(store, mockClock());
    service = new StandardOrderService(orderService, client, mockRegistrationStore());

    // Create a pending order first
    const checkout = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: validAddress });
    const result = await service.resolveOrder(checkout.order!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('confirmed');
  });

  it('resolveOrder_cancelOption_cancelsOrder', async () => {
    const client = mockOhppClient();
    (client.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'resolved', selectedOption: 'cancel' });
    const store = mockOrderStore();
    const orderService = new OrderService(store, mockClock());
    service = new StandardOrderService(orderService, client, mockRegistrationStore());

    const checkout = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: validAddress });
    const result = await service.resolveOrder(checkout.order!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('cancelled');
  });

  it('resolveOrder_expired_cancelsOrder', async () => {
    const client = mockOhppClient();
    (client.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, status: 'expired' });
    const store = mockOrderStore();
    const orderService = new OrderService(store, mockClock());
    service = new StandardOrderService(orderService, client, mockRegistrationStore());

    const checkout = await service.checkout({ userId: 'user-1', items: validItems, deliveryAddress: validAddress });
    const result = await service.resolveOrder(checkout.order!.id, 'user-1');
    expect(result.success).toBe(true);
    expect(result.order?.status).toBe('cancelled');
  });
});
