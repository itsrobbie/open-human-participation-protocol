import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  available: boolean;
}

const CATEGORIES = ['pizza', 'side', 'drink', 'dessert'] as const;
const CATEGORY_LABELS: Record<string, string> = { pizza: 'Pizza', side: 'Sides', drink: 'Drinks', dessert: 'Desserts' };

export function MenuPage() {
  const [activeCategory, setActiveCategory] = useState<string>('pizza');
  const navigate = useNavigate();

  const { data: items, isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get<MenuItem[]>('/api/menu'),
  });

  const filteredItems = (items ?? []).filter((item) => item.category === activeCategory);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Menu</h1>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto" data-testid="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-red-600 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
            data-testid={`category-tab-${cat}`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-stone-100 dark:bg-stone-800 rounded-lg h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="menu-grid">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/menu/${item.id}`)}
              disabled={!item.available}
              className={`bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-5 text-left hover:shadow-md transition-shadow ${
                !item.available ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              data-testid={`menu-item-${item.id}`}
            >
              <div className="w-full h-24 bg-stone-100 dark:bg-stone-700 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-3xl">🍕</span>
              </div>
              <h3 className="font-semibold mb-1">{item.name}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-2 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-600">£{(item.basePrice / 100).toFixed(2)}</span>
                {!item.available && <span className="text-xs text-stone-400">Unavailable</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
