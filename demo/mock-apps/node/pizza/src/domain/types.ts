/** Pizza app domain types */

export type PizzaSize = 'small' | 'medium' | 'large';
export type MenuCategory = 'pizza' | 'side' | 'drink' | 'dessert';
export type ToppingCategory = 'meat' | 'vegetable' | 'cheese' | 'sauce';

export type OrderStatus =
  | 'cart'
  | 'ohpp_pizza_in_progress'
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderMode = 'standard' | 'ohpp-pizza';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  basePrice: number; // pence
  imageUrl?: string;
  available: boolean;
}

export interface Topping {
  id: string;
  name: string;
  price: number; // pence
  category: ToppingCategory;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  size?: PizzaSize;
  toppings?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  instructions?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  status: OrderStatus;
  orderMode: OrderMode;
  deliveryAddress?: DeliveryAddress;
  scheduledFor?: string;
  specialInstructions?: string;
  participationRequestId?: string;
  participationStatus?: 'pending' | 'confirmed' | 'denied' | 'expired';
  transactionId?: string;
  ohppPizzaStep?: number;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
}

export interface OhppPizzaFlow {
  id: string;
  userId: string;
  transactionId: string;
  currentStep: number;
  totalSteps: number;
  status: 'in_progress' | 'completed' | 'cancelled' | 'expired';
  activeRequestId?: string;
  selections: OhppPizzaSelections;
  createdAt: string;
  updatedAt: string;
}

export interface OhppPizzaSelections {
  pizzaKey?: string;
  pizzaName?: string;
  pizzaPrice?: number;
  size?: PizzaSize;
  sizePrice?: number;
  toppings?: string[];
  toppingNames?: string[];
  specialInstructions?: string;
  deliveryDate?: string;
  tip?: number;
}

export interface PizzaAppUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  defaultAddress?: DeliveryAddress;
  ohppConnected: boolean;
  createdAt: string;
}

/** Size price modifiers (in pence) */
export const SIZE_PRICES: Record<PizzaSize, number> = {
  small: 0,
  medium: 200,
  large: 400,
};

/** Price per extra topping in pence */
export const TOPPING_PRICE = 150;

/** Standard delivery fee in pence */
export const DELIVERY_FEE = 299;
