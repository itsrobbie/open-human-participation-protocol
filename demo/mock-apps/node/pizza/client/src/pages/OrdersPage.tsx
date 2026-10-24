import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

export function OrdersPage() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<Order[]>('/api/orders'),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" data-testid="ohpp.pizza.orders.heading">My Orders</h1>

      {!orders?.length ? (
        <div className="text-center py-12 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg">
          <p className="text-stone-500 dark:text-stone-400 mb-3" data-testid="ohpp.pizza.orders.empty">No orders yet</p>
          <button onClick={() => navigate('/menu')} className="text-red-600 font-medium" data-testid="browse-menu-link">
            Browse Menu
          </button>
        </div>
      ) : (
        <div className="space-y-2" data-testid="orders-list">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 flex items-center gap-4 hover:border-red-200 dark:hover:border-red-800 transition-colors text-left"
              data-testid={`order-row-${order.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{order.items.map((i) => i.name).join(', ')}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="font-medium">£{(order.total / 100).toFixed(2)}</p>
              <StatusBadge status={order.status} />
              {order.orderMode === 'ohpp-pizza' && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">Via OHPP</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
