import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Package, Zap } from 'lucide-react';
import { api } from '../lib/api.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
}

interface ProductListResult {
  products: Product[];
  totalCount: number;
}

interface Purchase {
  id: string;
  items: { productName: string }[];
  total: number;
  status: string;
  createdAt: string;
}

interface OhppStatus {
  connected: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { data: productData } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => api.get<ProductListResult>('/api/products?pageSize=4&sortBy=rating'),
  });
  const { data: purchases } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.get<Purchase[]>('/api/purchases'),
  });
  const { data: ohppStatus } = useQuery({
    queryKey: ['ohpp-status'],
    queryFn: () => api.get<OhppStatus>('/api/ohpp/status'),
  });

  const featuredProducts = productData?.products ?? [];
  const recentPurchases = (purchases ?? []).slice(0, 3);
  const isConnected = ohppStatus?.connected ?? false;

  return (
    <div>
      {/* Hero section */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 dark:from-cyan-900/20 dark:to-purple-900/20 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 mb-8" data-testid="hero-section">
        <div className="max-w-lg">
          <h1 className="text-3xl font-bold mb-2">Welcome to NeonMarket</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Discover great products with secure purchases verified through OHPP.
          </p>
          <button
            onClick={() => navigate('/products')}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-2.5 px-5 rounded-lg transition-all"
            data-testid="browse-products-btn"
          >
            Browse Products
          </button>
        </div>
      </div>

      {/* OHPP status notice */}
      {!isConnected && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 mb-6" data-testid="ohpp-connect-prompt">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-cyan-600 shrink-0" />
            <p className="text-sm text-cyan-800 dark:text-cyan-200">
              <strong>Connect OHPP</strong> to verify purchases and unlock signature-based high-value transactions.{' '}
              <button onClick={() => navigate('/settings')} className="underline font-medium">Go to Settings</button>
            </p>
          </div>
        </div>
      )}

      {/* Featured Products */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top Rated</h2>
          <button onClick={() => navigate('/products?sortBy=rating')} className="text-sm text-cyan-600 hover:text-cyan-700" data-testid="view-all-products">
            View all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onClick={() => navigate(`/products/${product.id}`)} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="category-grid">
          {['electronics', 'clothing', 'home', 'sports', 'books', 'other'].map((cat) => (
            <button
              key={cat}
              onClick={() => navigate(`/products?category=${cat}`)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors"
              data-testid={`category-${cat}`}
            >
              <Package size={24} className="mx-auto mb-2 text-slate-400" />
              <span className="text-sm font-medium capitalize">{cat}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Purchases */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Purchases</h2>
          {recentPurchases.length > 0 && (
            <button onClick={() => navigate('/purchases')} className="text-sm text-cyan-600 hover:text-cyan-700" data-testid="view-all-purchases">
              View all
            </button>
          )}
        </div>
        {recentPurchases.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
            <ShoppingBag size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No purchases yet. Start by browsing products!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPurchases.map((purchase) => (
              <button
                key={purchase.id}
                onClick={() => navigate(`/purchases/${purchase.id}`)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center gap-4 hover:border-cyan-200 dark:hover:border-cyan-800 transition-colors text-left"
                data-testid={`recent-purchase-${purchase.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{purchase.items.map((i) => i.productName).join(', ')}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="font-medium">{'\u00A3'}{(purchase.total / 100).toFixed(2)}</p>
                <StatusBadge status={purchase.status} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
