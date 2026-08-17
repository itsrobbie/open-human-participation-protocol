import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Clock, CheckCircle, XCircle, Truck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { SignatureBadge } from '../components/SignatureBadge.tsx';

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Purchase {
  id: string;
  items: PurchaseItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: string;
  shippingAddress: { line1: string; city: string; postcode: string; country: string };
  deliverySlot?: string;
  participationRequestId?: string;
  participationStatus?: string;
  signatureAttestationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface RefundRequest {
  id: string;
  status: string;
}

const STATUS_TIMELINE = [
  { status: 'pending_confirmation', icon: Clock, label: 'Pending' },
  { status: 'confirmed', icon: CheckCircle, label: 'Confirmed' },
  { status: 'processing', icon: Clock, label: 'Processing' },
  { status: 'shipped', icon: Truck, label: 'Shipped' },
  { status: 'delivered', icon: CheckCircle, label: 'Delivered' },
];

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refundReason, setRefundReason] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => api.get<Purchase>(`/api/purchases/${id}`),
    refetchInterval: (query) => {
      const p = query.state.data;
      return p?.status === 'pending_confirmation' ? 3000 : false;
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => api.post<RefundRequest>('/api/refunds', { purchaseId: id }),
    onSuccess: () => {
      toast.success('Refund request initiated');
      setShowRefundForm(true);
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reasonMutation = useMutation({
    mutationFn: (body: { refundId: string; reason: string }) =>
      api.post(`/api/refunds/${body.refundId}/reason`, { reason: body.reason }),
    onSuccess: () => {
      toast.success('Refund reason submitted');
      setShowRefundForm(false);
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" /></div>;
  }

  if (!purchase) {
    return <div className="text-center py-12"><p className="text-slate-500">Purchase not found</p></div>;
  }

  const statusIndex = STATUS_TIMELINE.findIndex((s) => s.status === purchase.status);
  const isCancelled = purchase.status === 'cancelled' || purchase.status === 'refunded';
  const canRefund = purchase.status === 'delivered';

  return (
    <div>
      <button onClick={() => navigate('/purchases')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6" data-testid="back-button">
        <ArrowLeft size={16} /> All Purchases
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Order Details</h1>
        <StatusBadge status={purchase.status} />
        {purchase.signatureAttestationId && <SignatureBadge />}
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6" data-testid="status-timeline">
          <div className="flex items-center justify-between">
            {STATUS_TIMELINE.map((step, i) => {
              const isActive = i <= statusIndex;
              const Icon = step.icon;
              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    <Icon size={16} />
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'text-cyan-600 font-medium' : 'text-slate-400'}`}>{step.label}</span>
                  {i < STATUS_TIMELINE.length - 1 && (
                    <div className={`h-0.5 w-full mt-4 ${i < statusIndex ? 'bg-cyan-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled/refunded notice */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3">
          <XCircle size={20} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">This order was {purchase.status === 'refunded' ? 'refunded' : 'cancelled'}.</p>
        </div>
      )}

      {/* Items */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Items</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {purchase.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between py-3" data-testid={`item-${item.productId}`}>
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-slate-500">Qty: {item.quantity} x {'\u00A3'}{(item.unitPrice / 100).toFixed(2)}</p>
              </div>
              <p className="font-medium">{'\u00A3'}{(item.totalPrice / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3 space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{'\u00A3'}{(purchase.subtotal / 100).toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span>Shipping</span><span>{'\u00A3'}{(purchase.shippingCost / 100).toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold pt-1"><span>Total</span><span>{'\u00A3'}{(purchase.total / 100).toFixed(2)}</span></div>
        </div>
      </div>

      {/* Shipping info */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-2">Shipping</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {purchase.shippingAddress.line1}, {purchase.shippingAddress.city}, {purchase.shippingAddress.postcode}
        </p>
        {purchase.deliverySlot && (
          <p className="text-sm text-slate-500 mt-1">Delivery slot: {new Date(purchase.deliverySlot).toLocaleString()}</p>
        )}
      </div>

      {/* Refund section */}
      {canRefund && !showRefundForm && (
        <button
          onClick={() => refundMutation.mutate()}
          disabled={refundMutation.isPending}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium"
          data-testid="request-refund-btn"
        >
          <RotateCcw size={16} />
          {refundMutation.isPending ? 'Requesting...' : 'Request Refund'}
        </button>
      )}

      {showRefundForm && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6" data-testid="refund-form">
          <h2 className="font-semibold mb-3">Refund Reason</h2>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Please describe why you want a refund (min 10 characters)..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm min-h-24 mb-3"
            data-testid="refund-reason-input"
          />
          <button
            onClick={() => reasonMutation.mutate({ refundId: 'latest', reason: refundReason })}
            disabled={refundReason.length < 10 || reasonMutation.isPending}
            className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            data-testid="submit-refund-btn"
          >
            {reasonMutation.isPending ? 'Submitting...' : 'Submit Refund'}
          </button>
        </div>
      )}

      {/* Metadata */}
      <p className="text-xs text-slate-400 mt-6">
        Created: {new Date(purchase.createdAt).toLocaleString()} | Updated: {new Date(purchase.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
