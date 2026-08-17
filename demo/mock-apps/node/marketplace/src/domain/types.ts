/** Marketplace app domain types */

export type ProductCategory =
  | 'electronics'
  | 'clothing'
  | 'home'
  | 'sports'
  | 'books'
  | 'other';

export type PurchaseStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'refund_requested'
  | 'refunded'
  | 'cancelled';

export type RefundStatus =
  | 'pending_confirmation'
  | 'submitted'
  | 'approved'
  | 'denied'
  | 'completed';

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: number; // pence/cents
  category: ProductCategory;
  imageUrl?: string;
  stock: number;
  rating: number;
  reviewCount: number;
  bundleEligible: boolean;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
}

export interface Purchase {
  id: string;
  buyerId: string;
  items: PurchaseItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: PurchaseStatus;
  shippingAddress: ShippingAddress;
  deliverySlot?: string; // ISO 8601 datetime
  participationRequestId?: string;
  participationStatus?: 'pending' | 'confirmed' | 'denied' | 'expired';
  signatureAttestationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequest {
  id: string;
  purchaseId: string;
  buyerId: string;
  reason: string;
  amount: number;
  status: RefundStatus;
  participationRequestId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface MarketplaceUser {
  id: string;
  userId: string; // OHPP user ID from Keycloak
  displayName: string;
  email: string;
  defaultShippingAddress?: ShippingAddress;
  ohppConnected: boolean;
  createdAt: string;
}

/** Threshold for high-value purchases requiring signature (in pence/cents) */
export const HIGH_VALUE_THRESHOLD = 10000; // 100.00

/** Standard shipping cost in pence/cents */
export const SHIPPING_COST = 499;

/** Maximum days after delivery to request a refund */
export const REFUND_WINDOW_DAYS = 30;

/** Maximum days in the future for delivery slot */
export const MAX_DELIVERY_DAYS = 14;

/** Business hours for delivery slots */
export const BUSINESS_HOURS = { start: 8, end: 20 };
