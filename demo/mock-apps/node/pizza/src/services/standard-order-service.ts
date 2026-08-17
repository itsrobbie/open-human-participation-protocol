import type { OhppRequesterClient } from '@ohpp/sdk';
import type { CartItem, DeliveryAddress, Order } from '../domain/types.js';
import { DELIVERY_FEE } from '../domain/types.js';
import { OrderService } from './order-service.js';
import type { PostgresRegistrationStore } from '../infrastructure/postgres-registration-store.js';

export interface CheckoutParams {
  userId: string;
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  specialInstructions?: string;
}

export interface CheckoutResult {
  success: boolean;
  order?: Order;
  error?: string;
}

/**
 * Handles standard checkout with optional single OHPP select confirmation.
 */
export class StandardOrderService {
  constructor(
    private readonly orderService: OrderService,
    private readonly ohppClient: OhppRequesterClient,
    private readonly registrationStore: PostgresRegistrationStore,
  ) {}

  async checkout(params: CheckoutParams): Promise<CheckoutResult> {
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Cart must have at least 1 item' };
    }

    if (!params.deliveryAddress?.line1 || !params.deliveryAddress?.city || !params.deliveryAddress?.postcode) {
      return { success: false, error: 'Delivery address is incomplete' };
    }

    // Check if OHPP connected
    const isConnected = await this.registrationStore.hasRegistration(params.userId);

    if (!isConnected) {
      // No OHPP - confirm directly
      const result = await this.orderService.create({
        userId: params.userId,
        items: params.items,
        deliveryAddress: params.deliveryAddress,
        specialInstructions: params.specialInstructions,
        orderMode: 'standard',
      });
      return result;
    }

    // Get the Resolver's userId for this app user
    const registration = await this.registrationStore.getForAppUser(params.userId);
    if (!registration) {
      return { success: false, error: 'OHPP registration not found' };
    }

    // OHPP connected - send select confirmation request
    const subtotal = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal + DELIVERY_FEE;
    const totalFormatted = `£${(total / 100).toFixed(2)}`;

    const itemList = params.items
      .map((item) => `- ${item.name} x${item.quantity}: £${(item.totalPrice / 100).toFixed(2)}`)
      .join('\n');

    const sendResult = await this.ohppClient.sendRequest({
      userId: registration.userId,
      type: 'select',
      action: {
        summary: `Confirm pizza order for ${totalFormatted}`,
        description: `**Your Order**\n\n${itemList}\n\n**Delivery to**: ${params.deliveryAddress.line1}, ${params.deliveryAddress.city}`,
        category: 'orders',
      },
      options: [
        { key: 'confirm', label: `Confirm Order (${totalFormatted})` },
        { key: 'cancel', label: 'Cancel' },
      ],
      expiresInMs: 10 * 60 * 1000, // 10 minutes
    });

    if (!sendResult.success || !sendResult.requestId) {
      return { success: false, error: sendResult.error ?? 'Failed to send OHPP request' };
    }

    // Create order in pending state
    const result = await this.orderService.create({
      userId: params.userId,
      items: params.items,
      deliveryAddress: params.deliveryAddress,
      specialInstructions: params.specialInstructions,
      orderMode: 'standard',
      participationRequestId: sendResult.requestId,
    });

    return result;
  }

  /**
   * Resolves an order based on OHPP status poll result.
   */
  async resolveOrder(orderId: string, userId: string): Promise<CheckoutResult> {
    const order = await this.orderService.getById(orderId, userId);
    if (!order || !order.participationRequestId) {
      return { success: false, error: 'Order not found or has no pending request' };
    }

    if (order.status !== 'pending_confirmation') {
      return { success: true, order }; // Already resolved
    }

    // Get the Resolver's userId for status polling
    const registration = await this.registrationStore.getForAppUser(userId);
    if (!registration) {
      return { success: false, error: 'OHPP registration not found' };
    }

    const status = await this.ohppClient.getStatus(order.participationRequestId, registration.userId);
    if (!status.success) {
      return { success: false, error: status.error };
    }

    if (status.status === 'pending') {
      return { success: true, order }; // Still waiting
    }

    if (status.status === 'expired') {
      const cancelResult = await this.orderService.updateStatus(orderId, userId, 'cancelled');
      if (cancelResult.order) {
        cancelResult.order.participationStatus = 'expired';
      }
      return cancelResult;
    }

    if (status.status === 'resolved') {
      if (status.selectedOption === 'confirm') {
        const confirmResult = await this.orderService.updateStatus(orderId, userId, 'confirmed');
        if (confirmResult.order) {
          confirmResult.order.participationStatus = 'confirmed';
        }
        return confirmResult;
      } else {
        const denyResult = await this.orderService.updateStatus(orderId, userId, 'cancelled');
        if (denyResult.order) {
          denyResult.order.participationStatus = 'denied';
        }
        return denyResult;
      }
    }

    return { success: true, order };
  }
}
