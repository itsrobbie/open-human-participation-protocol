import type { Product, Purchase, RefundRequest, ProductCategory } from './types.js';

export interface IProductStore {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByCategory(category: ProductCategory): Promise<Product[]>;
  decrementStock(productId: string, quantity: number): Promise<boolean>;
}

export interface IPurchaseStore {
  save(purchase: Purchase): Promise<void>;
  getById(id: string, buyerId: string): Promise<Purchase | null>;
  getByBuyerId(buyerId: string): Promise<Purchase[]>;
  getByParticipationRequestId(requestId: string): Promise<Purchase | null>;
}

export interface IRefundStore {
  save(refund: RefundRequest): Promise<void>;
  getById(id: string, buyerId: string): Promise<RefundRequest | null>;
  getByPurchaseId(purchaseId: string): Promise<RefundRequest | null>;
  getActiveByPurchaseId(purchaseId: string): Promise<RefundRequest | null>;
  getByBuyerId(buyerId: string): Promise<RefundRequest[]>;
}

export interface IClock {
  now(): Date;
  isoNow(): string;
}

/**
 * Abstraction for checking whether a user has an active OHPP registration
 * and retrieving their Resolver credentials by app user ID.
 */
export interface IRegistrationChecker {
  hasRegistration(appUserId: string): Promise<boolean>;
  getForAppUser(appUserId: string): Promise<import('@ohpp/sdk').RegistrationCredentials | null>;
}
