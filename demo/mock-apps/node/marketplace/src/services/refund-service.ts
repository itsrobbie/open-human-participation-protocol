import { v4 as uuid } from 'uuid';
import type { OhppRequesterClient } from '@ohpp/sdk';
import type { IRefundStore, IPurchaseStore, IClock, IRegistrationChecker } from '../domain/interfaces.js';
import type { RefundRequest } from '../domain/types.js';
import { REFUND_WINDOW_DAYS } from '../domain/types.js';

export interface RefundResult {
  success: boolean;
  refund?: RefundRequest;
  error?: string;
}

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1000;

export class RefundService {
  constructor(
    private readonly refundStore: IRefundStore,
    private readonly purchaseStore: IPurchaseStore,
    private readonly ohppClient: OhppRequesterClient,
    private readonly registrationChecker: IRegistrationChecker,
    private readonly clock: IClock,
  ) {}

  async requestRefund(purchaseId: string, buyerId: string): Promise<RefundResult> {
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase) {
      return { success: false, error: 'Purchase not found' };
    }

    if (purchase.status !== 'delivered') {
      return { success: false, error: 'Only delivered purchases can be refunded' };
    }

    // Check for existing active refund
    const activeRefund = await this.refundStore.getActiveByPurchaseId(purchaseId);
    if (activeRefund) {
      return { success: false, error: 'This purchase already has an active refund request' };
    }

    // Check refund window (30 days from delivery/update)
    const deliveredAt = new Date(purchase.updatedAt);
    const now = this.clock.now();
    const daysSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > REFUND_WINDOW_DAYS) {
      return { success: false, error: `Refunds must be requested within 30 days of delivery` };
    }

    // Check OHPP connection and send select request
    const isConnected = await this.registrationChecker.hasRegistration(buyerId);

    const refund: RefundRequest = {
      id: uuid().replace(/-/g, ''),
      purchaseId,
      buyerId,
      reason: '',
      amount: purchase.total,
      status: 'pending_confirmation',
      createdAt: this.clock.isoNow(),
    };

    if (isConnected) {
      const itemList = purchase.items
        .map((i) => `- ${i.productName} x${i.quantity}`)
        .join('\n');

      const sendResult = await this.ohppClient.sendRequest({
        userId: buyerId,
        type: 'select',
        action: {
          summary: `Confirm refund for £${(purchase.total / 100).toFixed(2)}`,
          description: `**Items to refund**\n\n${itemList}`,
          category: 'refunds',
        },
        options: [
          { key: 'confirm', label: 'Confirm Refund Request' },
          { key: 'cancel', label: 'Cancel' },
        ],
        expiresInMs: 10 * 60 * 1000,
      });

      if (sendResult.success && sendResult.requestId) {
        refund.participationRequestId = sendResult.requestId;
      }
    }

    await this.refundStore.save(refund);
    return { success: true, refund };
  }

  async resolveRefund(
    refundId: string,
    buyerId: string,
    reason: string,
  ): Promise<RefundResult> {
    const refund = await this.refundStore.getById(refundId, buyerId);
    if (!refund) {
      return { success: false, error: 'Refund request not found' };
    }

    if (reason.length < MIN_REASON_LENGTH) {
      return { success: false, error: `Reason must be at least ${MIN_REASON_LENGTH} characters` };
    }

    if (reason.length > MAX_REASON_LENGTH) {
      return { success: false, error: `Reason must not exceed ${MAX_REASON_LENGTH} characters` };
    }

    refund.reason = reason;
    refund.status = 'submitted';
    refund.resolvedAt = this.clock.isoNow();
    await this.refundStore.save(refund);
    return { success: true, refund };
  }

  async getByBuyerId(buyerId: string): Promise<RefundRequest[]> {
    return this.refundStore.getByBuyerId(buyerId);
  }

  async getById(refundId: string, buyerId: string): Promise<RefundRequest | null> {
    return this.refundStore.getById(refundId, buyerId);
  }
}
