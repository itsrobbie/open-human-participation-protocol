import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Zap, ShoppingCart } from 'lucide-react';
import { api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface Order {
  id: string;
  items: { name: string }[];
  total: number;
  status: string;
  orderMode: string;
  createdAt: string;
}

interface OhppStatus {
  connected: boolean;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get<Order[]>('/api/orders') });
  const { data: ohppStatus } = useQuery({ queryKey: ['ohpp-status'], queryFn: () => api.get<OhppStatus>('/api/ohpp/status') });

  const recentOrders = (orders ?? []).slice(0, 3);
  const isConnected = ohppStatus?.connected ?? false;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome back</h1>

      {/* Order Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8" data-testid="order-mode-picker">
        {/* Standard Order */}
        <button
          onClick={() => navigate('/menu')}
          className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6 text-left hover:border-red-300 dark:hover:border-red-700 transition-colors group"
          data-testid="order-mode-standard"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-red-600" />
            </div>
            <h2 className="font-semibold text-lg">Order from Menu</h2>
          </div>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Browse our menu, build your order, and checkout. OHPP confirms at the end.</p>
        </button>

        {/* OHPP Pizza */}
        <button
          onClick={() => isConnected && navigate('/ohpp-pizza')}
          disabled={!isConnected}
          className={`bg-white dark:bg-stone-800 border rounded-xl p-6 text-left transition-colors ${
            isConnected
              ? 'border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-700'
              : 'border-stone-200 dark:border-stone-700 opacity-60 cursor-not-allowed'
          }`}
          data-testid="order-mode-ohpp-pizza"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-amber-600" />
            </div>
            <h2 className="font-semibold text-lg">Quick Order via OHPP</h2>
            {!isConnected && (
              <span className="ml-auto text-xs bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded">
                Connect OHPP first
              </span>
            )}
          </div>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            Order step-by-step via OHPP on your device. The protocol builds your pizza for you.
          </p>
        </button>
      </div>

      {/* OHPP Status */}
      {!isConnected && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6" data-testid="ohpp-connect-prompt">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Connect OHPP</strong> to unlock order confirmation and the OHPP Pizza experience.{' '}
            <button onClick={() => navigate('/settings')} className="underline font-medium">Go to Settings</button>
          </p>
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Recent Orders</h2>
          {recentOrders.length > 0 && (
            <button onClick={() => navigate('/orders')} className="text-sm text-red-600 hover:text-red-700" data-testid="view-all-orders">
              View all
            </button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-8 text-center">
            <ShoppingCart size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
            <p className="text-stone-500 dark:text-stone-400">No orders yet. Start by browsing the menu!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 flex items-center gap-4 hover:border-red-200 dark:hover:border-red-800 transition-colors text-left"
                data-testid={`recent-order-${order.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{order.items.map((i) => i.name).join(', ')}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-medium">£{(order.total / 100).toFixed(2)}</p>
                <StatusBadge status={order.status} />
                {order.orderMode === 'ohpp-pizza' && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    Via OHPP
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
