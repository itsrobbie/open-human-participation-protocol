import { v4 as uuid } from 'uuid';
import type { OhppRequesterClient, SendRequestParams } from '@ohpp/sdk';
import type { IOhppPizzaFlowStore, IOrderStore, IClock } from '../domain/interfaces.js';
import type { OhppPizzaFlow, OhppPizzaSelections, CartItem, Order } from '../domain/types.js';
import { SIZE_PRICES, TOPPING_PRICE, DELIVERY_FEE } from '../domain/types.js';
import type { PostgresRegistrationStore } from '../infrastructure/postgres-registration-store.js';

export interface FlowResult {
  success: boolean;
  flow?: OhppPizzaFlow;
  order?: Order;
  error?: string;
}

const TOTAL_STEPS = 7;
const FIRST_STEP_EXPIRY_MS = 15 * 60 * 1000;
const DEFAULT_STEP_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Orchestrates the sequential multi-step OHPP Pizza ordering flow.
 * Each step sends an OHPP request and waits for resolution before advancing.
 */
export class OhppPizzaFlowController {
  constructor(
    private readonly flowStore: IOhppPizzaFlowStore,
    private readonly orderStore: IOrderStore,
    private readonly ohppClient: OhppRequesterClient,
    private readonly registrationStore: PostgresRegistrationStore,
    private readonly clock: IClock,
  ) {}

  /**
   * Starts a new OHPP Pizza flow for the user.
   */
  async startFlow(userId: string): Promise<FlowResult> {
    const isConnected = await this.registrationStore.hasRegistration(userId);
    if (!isConnected) {
      return { success: false, error: 'OHPP not connected' };
    }

    // Check for existing active flow
    const existing = await this.flowStore.getActiveByUserId(userId);
    if (existing) {
      return { success: false, error: 'An OHPP Pizza flow is already in progress' };
    }

    const transactionId = `txn-ohpp-pizza-${uuid().replace(/-/g, '')}`;
    const flow: OhppPizzaFlow = {
      id: uuid().replace(/-/g, ''),
      userId,
      transactionId,
      currentStep: 1,
      totalSteps: TOTAL_STEPS,
      status: 'in_progress',
      selections: {},
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    // Send step 1 request
    const sendResult = await this.sendStepRequest(flow);
    if (!sendResult.success) {
      return { success: false, error: sendResult.error ?? 'Failed to send step 1 request' };
    }

    flow.activeRequestId = sendResult.requestId;
    await this.flowStore.save(flow);
    return { success: true, flow };
  }

  /**
   * Gets the current flow status for a user.
   */
  async getFlowStatus(userId: string): Promise<FlowResult> {
    const flow = await this.flowStore.getActiveByUserId(userId);
    if (!flow) {
      return { success: false, error: 'No active flow' };
    }
    return { success: true, flow };
  }

  /**
   * Polls the current step's status and advances if resolved.
   */
  async advanceFlow(flowId: string, userId: string): Promise<FlowResult> {
    const flow = await this.flowStore.getById(flowId, userId);
    if (!flow || flow.status !== 'in_progress') {
      return { success: false, error: 'No active flow found' };
    }

    if (!flow.activeRequestId) {
      return { success: false, error: 'No active request for current step' };
    }

    // Poll status using the Resolver's userId
    const registration = await this.registrationStore.getForAppUser(userId);
    const resolverUserId = registration?.userId ?? userId;
    const status = await this.ohppClient.getStatus(flow.activeRequestId, resolverUserId);
    if (!status.success) {
      return { success: false, error: status.error ?? 'Failed to poll status' };
    }

    if (status.status === 'pending') {
      return { success: true, flow }; // Still waiting
    }

    if (status.status === 'expired') {
      return this.abandonFlow(flow, 'expired');
    }

    if (status.status === 'cancelled') {
      return this.abandonFlow(flow, 'cancelled');
    }

    if (status.status === 'resolved') {
      return this.processStepResolution(flow, status.selectedOption, status.selectedOptions, status.value);
    }

    return { success: true, flow };
  }

  /**
   * Cancels the active flow.
   */
  async cancelFlow(flowId: string, userId: string): Promise<FlowResult> {
    const flow = await this.flowStore.getById(flowId, userId);
    if (!flow || flow.status !== 'in_progress') {
      return { success: false, error: 'No active flow to cancel' };
    }

    if (flow.activeRequestId) {
      const registration = await this.registrationStore.getForAppUser(userId);
      const resolverUserId = registration?.userId ?? userId;
      await this.ohppClient.cancelRequest(flow.activeRequestId, resolverUserId);
    }

    return this.abandonFlow(flow, 'cancelled');
  }

  private async processStepResolution(
    flow: OhppPizzaFlow,
    selectedOption?: string,
    selectedOptions?: string[],
    value?: string,
  ): Promise<FlowResult> {
    const step = flow.currentStep;

    switch (step) {
      case 1: // Pizza base selection
        if (!selectedOption) return this.abandonFlow(flow, 'cancelled');
        flow.selections.pizzaKey = selectedOption;
        flow.selections.pizzaName = this.getPizzaName(selectedOption);
        flow.selections.pizzaPrice = this.getPizzaPrice(selectedOption);
        break;

      case 2: // Size selection
        if (!selectedOption) return this.abandonFlow(flow, 'cancelled');
        flow.selections.size = selectedOption as OhppPizzaSelections['size'];
        flow.selections.sizePrice = SIZE_PRICES[selectedOption as keyof typeof SIZE_PRICES] ?? 0;
        break;

      case 3: // Toppings (multiselect)
        const toppings = (selectedOptions ?? []).filter((t) => t !== 'none');
        flow.selections.toppings = toppings;
        flow.selections.toppingNames = toppings; // will be resolved to names later
        break;

      case 4: // Special instructions (text)
        flow.selections.specialInstructions = value ?? '';
        break;

      case 5: // Delivery date
        if (value) {
          const date = new Date(value);
          const now = this.clock.now();
          const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (date < now || date > maxDate) {
            return this.abandonFlow(flow, 'cancelled');
          }
          flow.selections.deliveryDate = value;
        }
        break;

      case 6: // Tip (number)
        const tipAmount = value ? parseFloat(value) : 0;
        if (tipAmount < 0 || tipAmount > 50) {
          return this.abandonFlow(flow, 'cancelled');
        }
        flow.selections.tip = Math.round(tipAmount * 100); // convert to pence
        break;

      case 7: // Final confirmation
        if (selectedOption === 'cancel') {
          return this.abandonFlow(flow, 'cancelled');
        }
        if (selectedOption === 'confirm') {
          return this.completeFlow(flow);
        }
        return this.abandonFlow(flow, 'cancelled');
    }

    // Advance to next step
    flow.currentStep = step + 1;
    flow.activeRequestId = undefined;
    flow.updatedAt = this.clock.isoNow();

    if (flow.currentStep > TOTAL_STEPS) {
      // Should not happen (step 7 handles completion)
      return this.completeFlow(flow);
    }

    // Send next step request
    const sendResult = await this.sendStepRequest(flow);
    if (!sendResult.success) {
      return { success: false, error: sendResult.error ?? 'Failed to send next step' };
    }

    flow.activeRequestId = sendResult.requestId;
    await this.flowStore.save(flow);
    return { success: true, flow };
  }

  private async completeFlow(flow: OhppPizzaFlow): Promise<FlowResult> {
    flow.status = 'completed';
    flow.updatedAt = this.clock.isoNow();
    await this.flowStore.save(flow);

    // Create the order from collected selections
    const order = await this.createOrderFromSelections(flow);
    return { success: true, flow, order };
  }

  private async abandonFlow(flow: OhppPizzaFlow, reason: 'expired' | 'cancelled'): Promise<FlowResult> {
    flow.status = reason;
    flow.updatedAt = this.clock.isoNow();
    await this.flowStore.save(flow);
    return { success: true, flow };
  }

  private async sendStepRequest(flow: OhppPizzaFlow): Promise<{ success: boolean; requestId?: string; error?: string }> {
    // Resolve the Resolver's userId for this app user
    const registration = await this.registrationStore.getForAppUser(flow.userId);
    if (!registration) {
      return { success: false, error: 'OHPP registration not found' };
    }

    const params = this.buildStepParams(flow, registration.userId);
    if (!params) {
      return { success: false, error: 'Could not build request for step' };
    }

    const result = await this.ohppClient.sendRequest(params);
    return {
      success: result.success,
      requestId: result.requestId,
      error: result.error,
    };
  }

  private buildStepParams(flow: OhppPizzaFlow, resolverUserId: string): SendRequestParams | null {
    const userId = resolverUserId;
    const txn = { id: flow.transactionId, label: flow.currentStep === 1 ? 'OHPP Pizza Order' : undefined };
    const expiry = flow.currentStep === 1 ? FIRST_STEP_EXPIRY_MS : DEFAULT_STEP_EXPIRY_MS;

    switch (flow.currentStep) {
      case 1:
        return {
          userId,
          type: 'select',
          action: {
            summary: 'What pizza would you like?',
            description: "Pick your base pizza. We'll customise it next.",
            category: 'pizza-order',
          },
          options: [
            { key: 'margherita', label: 'Margherita (£9.99)' },
            { key: 'pepperoni', label: 'Pepperoni (£11.99)' },
            { key: 'bbq-chicken', label: 'BBQ Chicken (£12.99)' },
            { key: 'veggie-supreme', label: 'Veggie Supreme (£11.49)' },
            { key: 'meat-feast', label: 'Meat Feast (£13.99)' },
          ],
          transaction: txn,
          expiresInMs: expiry,
        };

      case 2:
        return {
          userId,
          type: 'select',
          action: {
            summary: `What size ${flow.selections.pizzaName}?`,
            description: 'Choose your pizza size',
          },
          options: [
            { key: 'small', label: 'Small 9" (no extra)' },
            { key: 'medium', label: 'Medium 11" (+£2.00)' },
            { key: 'large', label: 'Large 14" (+£4.00)' },
          ],
          transaction: txn,
          expiresInMs: expiry,
        };

      case 3:
        return {
          userId,
          type: 'multiselect',
          action: {
            summary: `Add extra toppings to your ${flow.selections.size} ${flow.selections.pizzaName}?`,
            description: "Select any additional toppings (£1.50 each). Select 'No extras' if you're happy.",
          },
          options: [
            { key: 'extra-cheese', label: 'Extra Mozzarella' },
            { key: 'jalapenos', label: 'Jalapenos' },
            { key: 'mushrooms', label: 'Mushrooms' },
            { key: 'olives', label: 'Black Olives' },
            { key: 'bacon', label: 'Crispy Bacon' },
            { key: 'none', label: 'No extras' },
          ],
          inputValidation: { required: true },
          transaction: txn,
          expiresInMs: expiry,
        };

      case 4:
        return {
          userId,
          type: 'text',
          action: {
            summary: 'Any special instructions?',
            description: `Allergies, preferences, or delivery notes for your ${flow.selections.pizzaName} order`,
          },
          placeholder: 'e.g., Well done base, no contact delivery',
          inputValidation: { required: false, max: 200 },
          transaction: txn,
          expiresInMs: expiry,
        };

      case 5:
        return {
          userId,
          type: 'date',
          action: {
            summary: 'When do you want your pizza?',
            description: 'Choose a delivery date. Pick today for ASAP delivery.',
          },
          inputValidation: { required: true },
          transaction: txn,
          expiresInMs: expiry,
        };

      case 6: {
        const currentTotal = this.calculateRunningTotal(flow.selections);
        const totalFormatted = `£${(currentTotal / 100).toFixed(2)}`;
        return {
          userId,
          type: 'number',
          action: {
            summary: 'Add a tip for your driver?',
            description: `Your **${flow.selections.size} ${flow.selections.pizzaName}** is **${totalFormatted}**. Tip is optional.`,
          },
          placeholder: '0.00',
          keyboard: 'decimal',
          inputValidation: { required: false, min: 0, max: 50 },
          transaction: txn,
          expiresInMs: expiry,
        };
      }

      case 7: {
        const total = this.calculateRunningTotal(flow.selections) + (flow.selections.tip ?? 0);
        const totalStr = `£${(total / 100).toFixed(2)}`;
        const toppingsStr = flow.selections.toppings?.length
          ? flow.selections.toppings.join(', ')
          : 'None';
        return {
          userId,
          type: 'select',
          action: {
            summary: 'Confirm your OHPP Pizza order?',
            description: `**${flow.selections.size} ${flow.selections.pizzaName}**\nToppings: ${toppingsStr}\nInstructions: ${flow.selections.specialInstructions || 'None'}\nDelivery: ${flow.selections.deliveryDate ?? 'ASAP'}\n\n**Total: ${totalStr}**`,
            rationale: 'This is your final chance to review before we start making your pizza.',
          },
          options: [
            { key: 'confirm', label: `Confirm Order (${totalStr})` },
            { key: 'cancel', label: 'Cancel' },
          ],
          transaction: txn,
          expiresInMs: expiry,
        };
      }

      default:
        return null;
    }
  }

  private calculateRunningTotal(selections: OhppPizzaSelections): number {
    let total = selections.pizzaPrice ?? 0;
    total += selections.sizePrice ?? 0;
    total += (selections.toppings?.length ?? 0) * TOPPING_PRICE;
    total += DELIVERY_FEE;
    return total;
  }

  private async createOrderFromSelections(flow: OhppPizzaFlow): Promise<Order> {
    const s = flow.selections;
    const toppingCount = s.toppings?.length ?? 0;
    const itemPrice = (s.pizzaPrice ?? 0) + (s.sizePrice ?? 0) + toppingCount * TOPPING_PRICE;

    const cartItem: CartItem = {
      id: uuid().replace(/-/g, ''),
      menuItemId: s.pizzaKey ?? 'unknown',
      name: `${s.size ?? 'medium'} ${s.pizzaName ?? 'Pizza'}`,
      size: s.size,
      toppings: s.toppings,
      quantity: 1,
      unitPrice: itemPrice,
      totalPrice: itemPrice,
      specialInstructions: s.specialInstructions,
    };

    const order: Order = {
      id: uuid().replace(/-/g, ''),
      userId: flow.userId,
      items: [cartItem],
      subtotal: itemPrice,
      deliveryFee: DELIVERY_FEE,
      tip: s.tip ?? 0,
      total: itemPrice + DELIVERY_FEE + (s.tip ?? 0),
      status: 'confirmed',
      orderMode: 'ohpp-pizza',
      scheduledFor: s.deliveryDate,
      specialInstructions: s.specialInstructions,
      transactionId: flow.transactionId,
      createdAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };

    await this.orderStore.save(order);
    return order;
  }

  private getPizzaName(key: string): string {
    const names: Record<string, string> = {
      margherita: 'Margherita',
      pepperoni: 'Pepperoni',
      'bbq-chicken': 'BBQ Chicken',
      'veggie-supreme': 'Veggie Supreme',
      'meat-feast': 'Meat Feast',
    };
    return names[key] ?? key;
  }

  private getPizzaPrice(key: string): number {
    const prices: Record<string, number> = {
      margherita: 999,
      pepperoni: 1199,
      'bbq-chicken': 1299,
      'veggie-supreme': 1149,
      'meat-feast': 1399,
    };
    return prices[key] ?? 999;
  }
}
