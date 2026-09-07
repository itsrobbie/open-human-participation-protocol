import type { MenuItem, Order, Topping, OhppPizzaFlow } from './types.js';

export interface IMenuStore {
  getAll(): Promise<MenuItem[]>;
  getById(id: string): Promise<MenuItem | null>;
  getByCategory(category: string): Promise<MenuItem[]>;
  getToppings(): Promise<Topping[]>;
}

export interface IOrderStore {
  save(order: Order): Promise<void>;
  getById(id: string, userId: string): Promise<Order | null>;
  getByUserId(userId: string): Promise<Order[]>;
  getByParticipationRequestId(requestId: string): Promise<Order | null>;
  updateStatus(id: string, status: Order['status'], updatedAt: string): Promise<void>;
}

export interface IOhppPizzaFlowStore {
  save(flow: OhppPizzaFlow): Promise<void>;
  getById(id: string, userId: string): Promise<OhppPizzaFlow | null>;
  getActiveByUserId(userId: string): Promise<OhppPizzaFlow | null>;
  getByTransactionId(transactionId: string): Promise<OhppPizzaFlow | null>;
  /** All in_progress flows across all users, for the background sequencer. */
  getAllActive(): Promise<OhppPizzaFlow[]>;
}

export interface IClock {
  now(): Date;
  isoNow(): string;
}
