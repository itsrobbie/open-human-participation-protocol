import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { getCart, removeFromCart, updateQuantity, clearCart, getCartTotal, type CartItem } from '../lib/cart.ts';

const DELIVERY_FEE = 299;

export function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>(getCart());
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', postcode: '' });

  const placeOrder = useMutation({
    mutationFn: () =>
      api.post('/api/orders', {
        items: cart,
        deliveryAddress: address,
      }),
    onSuccess: () => {
      clearCart();
      toast.success('Order placed!');
      navigate('/orders');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const subtotal = getCartTotal(cart);
  const total = subtotal + DELIVERY_FEE;

  if (cart.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 dark:text-stone-400 mb-4">Your cart is empty</p>
        <button onClick={() => navigate('/menu')} className="text-red-600 hover:text-red-700 font-medium" data-testid="browse-menu-link">
          Browse Menu
        </button>
      </div>
    );
  }

  const isAddressValid = address.line1.trim() && address.city.trim() && address.postcode.trim();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

      {/* Cart Items */}
      <div className="space-y-3 mb-6" data-testid="cart-items">
        {cart.map((item) => (
          <div key={item.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.name}</p>
              {item.toppings && item.toppings.length > 0 && (
                <p className="text-xs text-stone-400">+{item.toppings.length} toppings</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCart(updateQuantity(item.id, item.quantity - 1))}
                className="w-7 h-7 border border-stone-300 dark:border-stone-600 rounded text-sm"
                data-testid={`cart-item-minus-${item.id}`}
              >-</button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <button
                onClick={() => setCart(updateQuantity(item.id, item.quantity + 1))}
                className="w-7 h-7 border border-stone-300 dark:border-stone-600 rounded text-sm"
                data-testid={`cart-item-plus-${item.id}`}
              >+</button>
            </div>
            <span className="font-medium w-16 text-right">£{(item.totalPrice / 100).toFixed(2)}</span>
            <button
              onClick={() => setCart(removeFromCart(item.id))}
              className="text-stone-400 hover:text-red-500"
              aria-label={`Remove ${item.name}`}
              data-testid={`cart-item-remove-${item.id}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Delivery Address */}
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 mb-6">
        <h2 className="font-medium mb-3">Delivery Address</h2>
        <div className="space-y-3">
          <input
            value={address.line1}
            onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            placeholder="Address line 1 *"
            className="w-full border border-stone-300 dark:border-stone-600 dark:bg-stone-900 rounded-lg px-3 py-2 text-sm"
            data-testid="address-line1"
          />
          <input
            value={address.line2}
            onChange={(e) => setAddress({ ...address, line2: e.target.value })}
            placeholder="Address line 2"
            className="w-full border border-stone-300 dark:border-stone-600 dark:bg-stone-900 rounded-lg px-3 py-2 text-sm"
            data-testid="address-line2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              placeholder="City *"
              className="border border-stone-300 dark:border-stone-600 dark:bg-stone-900 rounded-lg px-3 py-2 text-sm"
              data-testid="address-city"
            />
            <input
              value={address.postcode}
              onChange={(e) => setAddress({ ...address, postcode: e.target.value })}
              placeholder="Postcode *"
              className="border border-stone-300 dark:border-stone-600 dark:bg-stone-900 rounded-lg px-3 py-2 text-sm"
              data-testid="address-postcode"
            />
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-stone-500">Subtotal</span>
          <span>£{(subtotal / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-stone-500">Delivery</span>
          <span>£{(DELIVERY_FEE / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-stone-200 dark:border-stone-700">
          <span>Total</span>
          <span data-testid="cart-total">£{(total / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Place Order */}
      <button
        onClick={() => placeOrder.mutate()}
        disabled={!isAddressValid || placeOrder.isPending}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-medium py-3 rounded-lg transition-colors"
        data-testid="place-order-button"
      >
        {placeOrder.isPending ? 'Placing order...' : 'Place Order'}
      </button>
    </div>
  );
}
