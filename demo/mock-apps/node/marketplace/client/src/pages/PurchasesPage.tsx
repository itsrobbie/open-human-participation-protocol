import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface Purchase {
  id: string;
  items: { productName: string; quantity: number }[];
  total: number;
  status: string;
  createdAt: string;
  signatureAttestationId?: string;
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.get<Purchase[]>('/api/purchases'),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Purchases</h1>

      {(!purchases || purchases.length === 0) ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
          <ShoppingBag size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">No purchases yet</p>
          <button
            onClick={() => navigate('/products')}
            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            Browse products
          </button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="purchases-list">
          {purchases.map((purchase) => (
            <button
              key={purchase.id}
              onClick={() => navigate(`/purchases/${purchase.id}`)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center gap-4 hover:border-cyan-200 dark:hover:border-cyan-800 transition-colors text-left"
              data-testid={`purchase-${purchase.id}`}
            >
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag size={18} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{purchase.items.map((i) => `${i.productName}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(purchase.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="font-medium shrink-0">{'\u00A3'}{(purchase.total / 100).toFixed(2)}</p>
              <StatusBadge status={purchase.status} />
              {purchase.signatureAttestationId && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0" data-testid="signature-badge">
                  Signed
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
