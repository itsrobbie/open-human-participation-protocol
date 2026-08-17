import { v4 as uuid } from 'uuid';
import type { OhppRequesterClient } from '@ohpp/sdk';
import type { IPurchaseStore, IProductStore, IClock, IRegistrationChecker } from '../domain/interfaces.js';
import type { Purchase, PurchaseItem, ShippingAddress } from '../domain/types.js';
import {
  HIGH_VALUE_THRESHOLD,
  SHIPPING_COST,
  MAX_DELIVERY_DAYS,
  BUSINESS_HOURS,
} from '../domain/types.js';

export interface CreatePurchaseParams {
  buyerId: string;
  items: { productId: string; quantity: number }[];
  shippingAddress: ShippingAddress;
}

export interface ResolveBundleParams {
  buyerId: string;
  selectedProductIds: string[];
  minItems: number;
  maxItems: number;
  shippingAddress: ShippingAddress;
}

export interface PurchaseResult {
  success: boolean;
  purchase?: Purchase;
  error?: string;
}

export class PurchaseService {
  constructor(
    private readonly purchaseStore: IPurchaseStore,
    private readonly productStore: IProductStore,
    private readonly ohppClient: OhppRequesterClient,
    private readonly registrationChecker: IRegistrationChecker,
    private readonly clock: IClock,
  ) {}

  /** Resolve the Resolver's userId for a given app user. */
  private async getResolverUserId(appUserId: string): Promise<string | null> {
    const reg = await this.registrationChecker.getForAppUser(appUserId);
    return reg?.userId ?? null;
  }

  async createPurchase(params: CreatePurchaseParams): Promise<PurchaseResult> {
    // Validate and resolve products
    const purchaseItems: PurchaseItem[] = [];
    for (const item of params.items) {
      const product = await this.productStore.getById(item.productId);
      if (!product) {
        return { success: false, error: `Product ${item.productId} not found` };
      }
      if (product.stock === 0) {
        return { success: false, error: `Product "${product.name}" is out of stock` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `Insufficient stock for "${product.name}" (available: ${product.stock})` };
      }
      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: product.price * item.quantity,
      });
    }

    const subtotal = purchaseItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const total = subtotal + SHIPPING_COST;
    const isHighValue = total >= HIGH_VALUE_THRESHOLD;

    // Check OHPP connection
    const isConnected = await this.registrationChecker.hasRegistration(params.buyerId);

    if (!isConnected) {
      // No OHPP - confirm directly and decrement stock
      for (const item of params.items) {
        await this.productStore.decrementStock(item.productId, item.quantity);
      }

      const purchase: Purchase = {
        id: uuid().replace(/-/g, ''),
        buyerId: params.buyerId,
        items: purchaseItems,
        subtotal,
        shippingCost: SHIPPING_COST,
        total,
        status: 'confirmed',
        shippingAddress: params.shippingAddress,
        createdAt: this.clock.isoNow(),
        updatedAt: this.clock.isoNow(),
      };

      await this.purchaseStore.save(purchase);
      return { success: true, purchase };
    }

    // OHPP connected - get Resolver credentials for this app user
    const registration = await this.registrationChecker.getForAppUser(params.buyerId);
    if (!registration) {
      return { success: false, error: 'OHPP registration not found' };
    }

    // Send request using the Resolver's userId (not the app's internal userId)
    const totalFormatted = `£${(total / 100).toFixed(2)}`;
    const itemList = purchaseItems
      .map((i) => `- ${i.productName} x${i.quantity}: £${(i.totalPrice / 100).toFixed(2)}`)
      .join('\n');

    const sendParams = isHighValue
      ? {
          userId: registration.userId,
          type: 'signature' as const,
          action: {
            summary: `Sign for high-value purchase of ${totalFormatted}`,
            description: `**Your Purchase**\n\n${itemList}\n\n**Total**: ${totalFormatted}\n\nThis purchase requires your signature due to its value.`,
            category: 'purchases',
          },
          expiresInMs: 15 * 60 * 1000,
        }
      : {
          userId: registration.userId,
          type: 'select' as const,
          action: {
            summary: `Confirm purchase of ${totalFormatted}`,
            description: `**Your Purchase**\n\n${itemList}\n\n**Shipping to**: ${params.shippingAddress.line1}, ${params.shippingAddress.city}`,
            category: 'purchases',
          },
          options: [
            { key: 'confirm', label: `Confirm Purchase (${totalFormatted})` },
            { key: 'cancel', label: 'Cancel' },
          ],
          expiresInMs: 10 * 60 * 1000,
        };

    const sendResult = await this.ohppClient.sendRequest(sendParams);

    if (!sendResult.success || !sendResult.requestId) {
      return { success: false, error: sendResult.error ?? 'Failed to send OHPP request' };
    }

    const purchase: Purchase = {
      id: uuid().replace(/-/g, ''),
      buyerId: params.buyerId,
      items: purchaseItems,
      subtotal,
      shippingCost: SHIPPING_COST,
      total,
      status: 'pending_confirmation',
      shippingAddress: params.shippingAddress,
      participationRequestId: sendResult.requestId,
      participationStatus: 'pending',
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  /**
   * Starts a bundle purchase by sending a multiselect OHPP request
   * with all bundle-eligible products as options.
   */
  async startBundlePurchase(buyerId: string, shippingAddress: ShippingAddress): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const isConnected = await this.registrationChecker.hasRegistration(buyerId);
    if (!isConnected) {
      return { success: false, error: 'OHPP connection required for bundle purchases' };
    }

    const allProducts = await this.productStore.getAll();
    const bundleProducts = allProducts.filter((p) => p.bundleEligible && p.stock > 0);

    if (bundleProducts.length < 2) {
      return { success: false, error: 'Not enough bundle-eligible products available' };
    }

    const options = bundleProducts.map((p) => ({
      key: p.id,
      label: `${p.name} (£${(p.price / 100).toFixed(2)})`,
    }));

    const sendResult = await this.ohppClient.sendRequest({
      userId: resolverUserId!,
      type: 'multiselect',
      action: {
        summary: 'Choose items for your bundle deal',
        description: 'Select 2-5 items to include in your bundle. Shipping is included.',
        category: 'purchases',
      },
      options,
      inputValidation: { min: 2, max: 5 },
      expiresInMs: 10 * 60 * 1000,
    });

    if (!sendResult.success || !sendResult.requestId) {
      return { success: false, error: sendResult.error ?? 'Failed to send bundle OHPP request' };
    }

    // Create a placeholder purchase in pending state
    const purchase: Purchase = {
      id: uuid().replace(/-/g, ''),
      buyerId,
      items: [], // populated on resolution
      subtotal: 0,
      shippingCost: SHIPPING_COST,
      total: SHIPPING_COST,
      status: 'pending_confirmation',
      shippingAddress,
      participationRequestId: sendResult.requestId,
      participationStatus: 'pending',
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  /**
   * Validates and finalises a bundle selection (called internally during resolution).
   */
  async resolveBundle(params: ResolveBundleParams): Promise<PurchaseResult> {
    if (params.selectedProductIds.length < params.minItems) {
      return { success: false, error: `Bundle requires at least ${params.minItems} items` };
    }
    if (params.selectedProductIds.length > params.maxItems) {
      return { success: false, error: `Bundle allows at most ${params.maxItems} items` };
    }

    const purchaseItems: PurchaseItem[] = [];
    for (const productId of params.selectedProductIds) {
      const product = await this.productStore.getById(productId);
      if (!product) {
        return { success: false, error: `Product "${productId}" not found` };
      }
      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      });
    }

    const subtotal = purchaseItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const total = subtotal + SHIPPING_COST;

    const purchase: Purchase = {
      id: uuid().replace(/-/g, ''),
      buyerId: params.buyerId,
      items: purchaseItems,
      subtotal,
      shippingCost: SHIPPING_COST,
      total,
      status: 'pending_confirmation',
      shippingAddress: params.shippingAddress,
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  async resolveDeliverySlot(
    purchaseId: string,
    buyerId: string,
    deliverySlot: string,
  ): Promise<PurchaseResult> {
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase) {
      return { success: false, error: 'Purchase not found' };
    }

    const slotDate = new Date(deliverySlot);
    const now = this.clock.now();

    if (slotDate.getTime() <= now.getTime()) {
      return { success: false, error: 'Delivery slot cannot be in the past' };
    }

    const hour = slotDate.getUTCHours();
    if (hour < BUSINESS_HOURS.start || hour >= BUSINESS_HOURS.end) {
      return { success: false, error: `Delivery slot must be within business hours (${BUSINESS_HOURS.start}:00-${BUSINESS_HOURS.end}:00)` };
    }

    const maxDate = new Date(now.getTime() + MAX_DELIVERY_DAYS * 24 * 60 * 60 * 1000);
    if (slotDate.getTime() > maxDate.getTime()) {
      return { success: false, error: `Delivery slot must be within 14 days` };
    }

    purchase.deliverySlot = deliverySlot;
    purchase.updatedAt = this.clock.isoNow();
    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  /**
   * Sends a datetime OHPP request for the user to choose a delivery slot.
   */
  async requestDeliverySlot(purchaseId: string, buyerId: string): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase) {
      return { success: false, error: 'Purchase not found' };
    }

    if (purchase.status !== 'confirmed') {
      return { success: false, error: 'Delivery slot can only be requested for confirmed purchases' };
    }

    const isConnected = await this.registrationChecker.hasRegistration(buyerId);
    if (!isConnected) {
      return { success: false, error: 'OHPP connection required for delivery slot selection' };
    }

    const sendResult = await this.ohppClient.sendRequest({
      userId: resolverUserId!,
      type: 'datetime',
      action: {
        summary: 'Choose your delivery slot',
        description: `Select a preferred delivery date and time for your order.\n\n**Constraints**: Business hours (${BUSINESS_HOURS.start}:00-${BUSINESS_HOURS.end}:00), within the next ${MAX_DELIVERY_DAYS} days.`,
        category: 'purchases',
      },
      inputValidation: { required: true },
      expiresInMs: 10 * 60 * 1000,
    });

    if (!sendResult.success || !sendResult.requestId) {
      return { success: false, error: sendResult.error ?? 'Failed to send delivery slot OHPP request' };
    }

    purchase.participationRequestId = sendResult.requestId;
    purchase.participationStatus = 'pending';
    purchase.updatedAt = this.clock.isoNow();
    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  /**
   * Sends a number OHPP request for the user to confirm the purchase total.
   */
  async requestTotalVerification(purchaseId: string, buyerId: string): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase) {
      return { success: false, error: 'Purchase not found' };
    }

    if (purchase.status !== 'confirmed') {
      return { success: false, error: 'Total verification can only be requested for confirmed purchases' };
    }

    const isConnected = await this.registrationChecker.hasRegistration(buyerId);
    if (!isConnected) {
      return { success: false, error: 'OHPP connection required for total verification' };
    }

    const totalFormatted = (purchase.total / 100).toFixed(2);
    const itemList = purchase.items
      .map((i) => `- ${i.productName} x${i.quantity}: £${(i.totalPrice / 100).toFixed(2)}`)
      .join('\n');

    const sendResult = await this.ohppClient.sendRequest({
      userId: resolverUserId!,
      type: 'number',
      action: {
        summary: `Confirm your purchase total: £${totalFormatted}`,
        description: `**Order breakdown**\n\n${itemList}\n\nShipping: £${(purchase.shippingCost / 100).toFixed(2)}\n\n**Enter the total amount to confirm.**`,
        category: 'purchases',
      },
      placeholder: totalFormatted,
      keyboard: 'decimal',
      inputValidation: { required: true, min: 0 },
      expiresInMs: 10 * 60 * 1000,
    });

    if (!sendResult.success || !sendResult.requestId) {
      return { success: false, error: sendResult.error ?? 'Failed to send verification OHPP request' };
    }

    purchase.participationRequestId = sendResult.requestId;
    purchase.participationStatus = 'pending';
    purchase.updatedAt = this.clock.isoNow();
    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  async resolvePurchase(purchaseId: string, buyerId: string): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase || !purchase.participationRequestId) {
      return { success: false, error: 'Purchase not found or has no pending request' };
    }

    if (purchase.status !== 'pending_confirmation') {
      return { success: true, purchase };
    }

    const status = await this.ohppClient.getStatus(purchase.participationRequestId, resolverUserId!);
    if (!status.success) {
      return { success: false, error: status.error };
    }

    if (status.status === 'pending') {
      return { success: true, purchase };
    }

    if (status.status === 'expired') {
      purchase.status = 'cancelled';
      purchase.participationStatus = 'expired';
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: true, purchase };
    }

    if (status.status === 'resolved') {
      // Handle multiselect (bundle) resolution
      if (status.selectedOptions && status.selectedOptions.length > 0) {
        return this.resolveBundleFromOhpp(purchase, status.selectedOptions);
      }

      // Handle select (confirm/cancel)
      if (status.selectedOption === 'confirm') {
        for (const item of purchase.items) {
          await this.productStore.decrementStock(item.productId, item.quantity);
        }
        purchase.status = 'confirmed';
        purchase.participationStatus = 'confirmed';
        purchase.updatedAt = this.clock.isoNow();
        await this.purchaseStore.save(purchase);
        return { success: true, purchase };
      }

      // Handle signature resolution (value present, no select/multiselect)
      if (status.value && !status.selectedOption && (!status.selectedOptions || status.selectedOptions.length === 0)) {
        for (const item of purchase.items) {
          await this.productStore.decrementStock(item.productId, item.quantity);
        }
        purchase.status = 'confirmed';
        purchase.participationStatus = 'confirmed';
        purchase.signatureAttestationId = purchase.participationRequestId;
        purchase.updatedAt = this.clock.isoNow();
        await this.purchaseStore.save(purchase);
        return { success: true, purchase };
      }

      // Handle cancel
      if (status.selectedOption === 'cancel') {
        purchase.status = 'cancelled';
        purchase.participationStatus = 'denied';
        purchase.updatedAt = this.clock.isoNow();
        await this.purchaseStore.save(purchase);
        return { success: true, purchase };
      }

      // Fallback: treat any unrecognized resolution as denied
      purchase.status = 'cancelled';
      purchase.participationStatus = 'denied';
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: true, purchase };
    }

    return { success: true, purchase };
  }

  /**
   * Resolves delivery slot from an OHPP datetime response.
   */
  async resolveDeliverySlotFromOhpp(purchaseId: string, buyerId: string): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase || !purchase.participationRequestId) {
      return { success: false, error: 'Purchase not found or has no pending request' };
    }

    const status = await this.ohppClient.getStatus(purchase.participationRequestId, resolverUserId!);
    if (!status.success) {
      return { success: false, error: status.error };
    }

    if (status.status === 'pending') {
      return { success: true, purchase };
    }

    if (status.status === 'expired') {
      purchase.participationStatus = 'expired';
      purchase.participationRequestId = undefined;
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: true, purchase };
    }

    if (status.status === 'resolved' && status.value) {
      return this.resolveDeliverySlot(purchaseId, buyerId, status.value);
    }

    return { success: true, purchase };
  }

  /**
   * Resolves total verification from an OHPP number response.
   */
  async resolveTotalVerification(purchaseId: string, buyerId: string): Promise<PurchaseResult> {
    const resolverUserId = await this.getResolverUserId(buyerId);
    const purchase = await this.purchaseStore.getById(purchaseId, buyerId);
    if (!purchase || !purchase.participationRequestId) {
      return { success: false, error: 'Purchase not found or has no pending request' };
    }

    const status = await this.ohppClient.getStatus(purchase.participationRequestId, resolverUserId!);
    if (!status.success) {
      return { success: false, error: status.error };
    }

    if (status.status === 'pending') {
      return { success: true, purchase };
    }

    if (status.status === 'expired') {
      purchase.participationStatus = 'expired';
      purchase.participationRequestId = undefined;
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: true, purchase };
    }

    if (status.status === 'resolved' && status.value) {
      const submittedAmount = parseFloat(status.value);
      if (isNaN(submittedAmount)) {
        return { success: false, error: 'Non-numeric value received for total verification' };
      }

      const expectedPounds = purchase.total / 100;
      const tolerance = 0.01;

      if (Math.abs(submittedAmount - expectedPounds) <= tolerance) {
        // Total matches - verification passed
        purchase.participationStatus = 'confirmed';
        purchase.participationRequestId = undefined;
        purchase.updatedAt = this.clock.isoNow();
        await this.purchaseStore.save(purchase);
        return { success: true, purchase };
      } else {
        // Mismatch - flag for review
        return { success: false, error: `Total mismatch: expected £${expectedPounds.toFixed(2)}, received £${submittedAmount.toFixed(2)}` };
      }
    }

    return { success: true, purchase };
  }

  /**
   * Resolves a bundle purchase from the OHPP multiselect response.
   */
  private async resolveBundleFromOhpp(purchase: Purchase, selectedProductIds: string[]): Promise<PurchaseResult> {
    if (selectedProductIds.length < 2) {
      purchase.status = 'cancelled';
      purchase.participationStatus = 'denied';
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: false, error: 'Bundle requires at least 2 items' };
    }
    if (selectedProductIds.length > 5) {
      purchase.status = 'cancelled';
      purchase.participationStatus = 'denied';
      purchase.updatedAt = this.clock.isoNow();
      await this.purchaseStore.save(purchase);
      return { success: false, error: 'Bundle allows at most 5 items' };
    }

    const purchaseItems: PurchaseItem[] = [];
    for (const productId of selectedProductIds) {
      const product = await this.productStore.getById(productId);
      if (!product) {
        purchase.status = 'cancelled';
        purchase.participationStatus = 'denied';
        purchase.updatedAt = this.clock.isoNow();
        await this.purchaseStore.save(purchase);
        return { success: false, error: `Product "${productId}" not found in bundle options` };
      }
      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      });
    }

    const subtotal = purchaseItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const total = subtotal + SHIPPING_COST;

    purchase.items = purchaseItems;
    purchase.subtotal = subtotal;
    purchase.total = total;
    purchase.status = 'confirmed';
    purchase.participationStatus = 'confirmed';
    purchase.updatedAt = this.clock.isoNow();

    for (const item of purchaseItems) {
      await this.productStore.decrementStock(item.productId, item.quantity);
    }

    await this.purchaseStore.save(purchase);
    return { success: true, purchase };
  }

  async getHistory(buyerId: string): Promise<Purchase[]> {
    return this.purchaseStore.getByBuyerId(buyerId);
  }

  async getById(purchaseId: string, buyerId: string): Promise<Purchase | null> {
    return this.purchaseStore.getById(purchaseId, buyerId);
  }
}
