import { v4 as uuid } from 'uuid';
import type { IOrderStore, IClock } from '../domain/interfaces.js';
import type { Order, OrderStatus, CartItem, DeliveryAddress } from '../domain/types.js';
import { DELIVERY_FEE } from '../domain/types.js';

export interface CreateOrderParams {
  userId: string;
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  specialInstructions?: string;
  orderMode: 'standard' | 'ohpp-pizza';
  participationRequestId?: string;
  transactionId?: string;
  scheduledFor?: string;
  tip?: number;
}

export interface OrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  cart: ['pending_confirmation', 'confirmed', 'ohpp_pizza_in_progress'],
  ohpp_pizza_in_progress: ['confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export class OrderService {
  constructor(
    private readonly orderStore: IOrderStore,
    private readonly clock: IClock,
  ) {}

  async create(params: CreateOrderParams): Promise<OrderResult> {
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Cart must have at least 1 item' };
    }

    const subtotal = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tip = params.tip ?? 0;
    const total = subtotal + DELIVERY_FEE + tip;

    const initialStatus: OrderStatus = params.participationRequestId
      ? 'pending_confirmation'
      : params.orderMode === 'ohpp-pizza'
        ? 'ohpp_pizza_in_progress'
        : 'confirmed';

    const order: Order = {
      id: uuid().replace(/-/g, ''),
      userId: params.userId,
      items: params.items,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      tip,
      total,
      status: initialStatus,
      orderMode: params.orderMode,
      deliveryAddress: params.deliveryAddress,
      scheduledFor: params.scheduledFor,
      specialInstructions: params.specialInstructions,
      participationRequestId: params.participationRequestId,
      participationStatus: params.participationRequestId ? 'pending' : undefined,
      transactionId: params.transactionId,
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    await this.orderStore.save(order);
    return { success: true, order };
  }

  async cancel(orderId: string, userId: string): Promise<OrderResult> {
    const order = await this.orderStore.getById(orderId, userId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const cancellable: OrderStatus[] = ['pending_confirmation', 'ohpp_pizza_in_progress', 'confirmed'];
    if (!cancellable.includes(order.status)) {
      return { success: false, error: `Cannot cancel order in ${order.status} status` };
    }

    order.status = 'cancelled';
    order.updatedAt = this.clock.isoNow();
    await this.orderStore.save(order);
    return { success: true, order };
  }

  async updateStatus(orderId: string, userId: string, newStatus: OrderStatus): Promise<OrderResult> {
    const order = await this.orderStore.getById(orderId, userId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return { success: false, error: `Invalid transition from ${order.status} to ${newStatus}` };
    }

    order.status = newStatus;
    order.updatedAt = this.clock.isoNow();
    await this.orderStore.save(order);
    return { success: true, order };
  }

  async getHistory(userId: string): Promise<Order[]> {
    return this.orderStore.getByUserId(userId);
  }

  async getById(orderId: string, userId: string): Promise<Order | null> {
    return this.orderStore.getById(orderId, userId);
  }
}
