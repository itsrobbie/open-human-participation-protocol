import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CountdownTimer } from '../components/CountdownTimer.tsx';

interface Order {
  id: string;
  items: { name: string; quantity: number; totalPrice: number }[];
  total: number;
  deliveryFee: number;
  tip: number;
  subtotal: number;
  status: string;
  orderMode: string;
  deliveryAddress?: { line1: string; city: string; postcode: string };
  participationRequestId?: string;
  participationStatus?: string;
  createdAt: string;
  scheduledFor?: string;
}

const STATUS_STEPS = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
  });

  // Poll status if pending
  useQuery({
    queryKey: ['order-status', id],
    queryFn: () => api.get<Order>(`/api/orders/${id}/status`),
    enabled: order?.status === 'pending_confirmation',
    refetchInterval: 5000,
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.post(`/api/orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Order cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="animate-pulse h-64 bg-stone-100 dark:bg-stone-800 rounded-lg" />;
  if (!order) return <p>Order not found</p>;

  const canCancel = ['pending_confirmation', 'confirmed', 'ohpp_pizza_in_progress'].includes(order.status);
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/orders')} className="text-sm text-red-600 hover:text-red-700 mb-4" data-testid="back-to-orders">
        ← Back to Orders
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
        <StatusBadge status={order.status} />
        {order.orderMode === 'ohpp-pizza' && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">Via OHPP</span>
        )}
      </div>

      {/* Pending confirmation banner */}
      {order.status === 'pending_confirmation' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 flex items-center gap-3" data-testid="pending-banner">
          <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">Awaiting your confirmation</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">Check your OHPP device to confirm this order</p>
          </div>
          <CountdownTimer startedAt={order.createdAt} durationMs={10 * 60 * 1000} />
        </div>
      )}

      {/* Status Timeline */}
      {currentStepIndex >= 0 && (
        <div className="mb-6" data-testid="status-timeline">
          <div className="flex items-center gap-2">
            {STATUS_STEPS.map((step, idx) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={`w-4 h-4 rounded-full ${idx <= currentStepIndex ? 'bg-green-500' : 'bg-stone-300 dark:bg-stone-600'}`} />
                <span className={`text-xs capitalize ${idx <= currentStepIndex ? 'text-green-700 dark:text-green-400 font-medium' : 'text-stone-400'}`}>
                  {step.replace(/_/g, ' ')}
                </span>
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${idx < currentStepIndex ? 'bg-green-500' : 'bg-stone-300 dark:bg-stone-600'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 mb-4">
        <h2 className="font-medium mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span>£{(item.totalPrice / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-stone-200 dark:border-stone-700 pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm text-stone-500"><span>Subtotal</span><span>£{(order.subtotal / 100).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-stone-500"><span>Delivery</span><span>£{(order.deliveryFee / 100).toFixed(2)}</span></div>
            {order.tip > 0 && <div className="flex justify-between text-sm text-stone-500"><span>Tip</span><span>£{(order.tip / 100).toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold"><span>Total</span><span>£{(order.total / 100).toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* Delivery */}
      {order.deliveryAddress && (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 mb-4">
          <h2 className="font-medium mb-2">Delivery</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {order.deliveryAddress.line1}, {order.deliveryAddress.city}, {order.deliveryAddress.postcode}
          </p>
          {order.scheduledFor && <p className="text-sm text-stone-500 mt-1">Scheduled: {new Date(order.scheduledFor).toLocaleDateString()}</p>}
        </div>
      )}

      {/* Cancel */}
      {canCancel && (
        <button
          onClick={() => cancelOrder.mutate()}
          disabled={cancelOrder.isPending}
          className="text-red-600 hover:text-red-700 text-sm font-medium mt-4"
          data-testid="cancel-order-button"
        >
          {cancelOrder.isPending ? 'Cancelling...' : 'Cancel Order'}
        </button>
      )}
    </div>
  );
}
