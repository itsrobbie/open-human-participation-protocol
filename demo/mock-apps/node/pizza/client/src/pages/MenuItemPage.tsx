import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { addToCart } from '../lib/cart.ts';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  available: boolean;
}

interface Topping {
  id: string;
  name: string;
  price: number;
  category: string;
}

const SIZE_OPTIONS = [
  { key: 'small', label: 'Small 9"', priceAdd: 0 },
  { key: 'medium', label: 'Medium 11"', priceAdd: 200 },
  { key: 'large', label: 'Large 14"', priceAdd: 400 },
];

export function MenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [size, setSize] = useState('medium');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const { data: item, isLoading } = useQuery({
    queryKey: ['menu', id],
    queryFn: () => api.get<MenuItem>(`/api/menu/${id}`),
  });

  const { data: toppings } = useQuery({
    queryKey: ['toppings'],
    queryFn: () => api.get<Topping[]>('/api/menu/toppings'),
    enabled: item?.category === 'pizza',
  });

  if (isLoading) return <div className="animate-pulse h-64 bg-stone-100 dark:bg-stone-800 rounded-lg" />;
  if (!item) return <p>Item not found</p>;

  const isPizza = item.category === 'pizza';
  const sizePrice = isPizza ? (SIZE_OPTIONS.find((s) => s.key === size)?.priceAdd ?? 0) : 0;
  const toppingPrice = selectedToppings.length * 150;
  const unitPrice = item.basePrice + sizePrice + toppingPrice;
  const totalPrice = unitPrice * quantity;

  function handleAddToCart() {
    if (!item) return;
    addToCart({
      id: `${item.id}-${size}-${Date.now()}`,
      menuItemId: item.id,
      name: isPizza ? `${SIZE_OPTIONS.find((s) => s.key === size)?.label} ${item.name}` : item.name,
      size: isPizza ? size : undefined,
      toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      quantity,
      unitPrice,
      totalPrice,
      specialInstructions: instructions || undefined,
    });
    toast.success(`${item.name} added to cart`);
    navigate('/menu');
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/menu')} className="text-sm text-red-600 hover:text-red-700 mb-4" data-testid="back-to-menu">
        ← Back to Menu
      </button>

      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6">
        <div className="w-full h-40 bg-stone-100 dark:bg-stone-700 rounded-lg mb-4 flex items-center justify-center">
          <span className="text-5xl">🍕</span>
        </div>

        <h1 className="text-2xl font-bold mb-2">{item.name}</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6">{item.description}</p>

        {/* Size selector (pizza only) */}
        {isPizza && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Size</h3>
            <div className="flex gap-2" data-testid="size-selector">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSize(opt.key)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                    size === opt.key
                      ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-stone-200 dark:border-stone-700 hover:border-red-300'
                  }`}
                  data-testid={`size-${opt.key}`}
                >
                  {opt.label} {opt.priceAdd > 0 && `(+£${(opt.priceAdd / 100).toFixed(2)})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toppings (pizza only) */}
        {isPizza && toppings && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Extra Toppings (£1.50 each)</h3>
            <div className="grid grid-cols-2 gap-2" data-testid="toppings-list">
              {toppings.map((topping) => (
                <label key={topping.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedToppings.includes(topping.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (selectedToppings.length < 10) setSelectedToppings([...selectedToppings, topping.id]);
                      } else {
                        setSelectedToppings(selectedToppings.filter((t) => t !== topping.id));
                      }
                    }}
                    className="rounded border-stone-300"
                    data-testid={`topping-${topping.id}`}
                  />
                  {topping.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Quantity</h3>
          <div className="flex items-center gap-3" data-testid="quantity-selector">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 border border-stone-300 dark:border-stone-600 rounded flex items-center justify-center"
              data-testid="quantity-minus"
            >
              -
            </button>
            <span className="font-medium w-8 text-center" data-testid="quantity-value">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-8 h-8 border border-stone-300 dark:border-stone-600 rounded flex items-center justify-center"
              data-testid="quantity-plus"
            >
              +
            </button>
          </div>
        </div>

        {/* Special instructions */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Special Instructions</h3>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, 200))}
            placeholder="Any allergies or preferences..."
            className="w-full border border-stone-300 dark:border-stone-600 dark:bg-stone-900 rounded-lg px-3 py-2 text-sm resize-none h-20"
            data-testid="special-instructions"
          />
          <p className="text-xs text-stone-400 mt-1">{instructions.length}/200</p>
        </div>

        {/* Price + Add to cart */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-700">
          <div>
            <span className="text-2xl font-bold text-red-600" data-testid="item-total">
              £{(totalPrice / 100).toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            data-testid="add-to-cart-button"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
