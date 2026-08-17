/**
 * Client-side cart state persisted in localStorage.
 */
export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  size?: string;
  toppings?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

const CART_KEY = 'pizza-cart';

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  // Check if same config exists
  const existing = cart.find(
    (i) => i.menuItemId === item.menuItemId && i.size === item.size && JSON.stringify(i.toppings) === JSON.stringify(item.toppings),
  );
  if (existing) {
    existing.quantity += item.quantity;
    existing.totalPrice = existing.unitPrice * existing.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(itemId: string): CartItem[] {
  const cart = getCart().filter((i) => i.id !== itemId);
  saveCart(cart);
  return cart;
}

export function updateQuantity(itemId: string, quantity: number): CartItem[] {
  const cart = getCart();
  const item = cart.find((i) => i.id === itemId);
  if (item) {
    item.quantity = Math.max(1, Math.min(10, quantity));
    item.totalPrice = item.unitPrice * item.quantity;
  }
  saveCart(cart);
  return cart;
}

export function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}
