import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Shield, Package } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { RatingStars } from '../components/RatingStars.tsx';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  rating: number;
  reviewCount: number;
  bundleEligible: boolean;
}

interface Purchase {
  id: string;
  status: string;
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/api/products/${id}`),
  });

  const purchaseMutation = useMutation({
    mutationFn: (body: unknown) => api.post<Purchase>('/api/purchases', body),
    onSuccess: (purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Purchase initiated');
      navigate(`/purchases/${purchase.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleBuy() {
    if (!product) return;
    purchaseMutation.mutate({
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: {
        line1: '123 Demo Street',
        city: 'London',
        postcode: 'E1 1AA',
        country: 'UK',
      },
    });
  }

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" /><div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div>;
  }

  if (!product) {
    return <div className="text-center py-12"><p className="text-slate-500">Product not found</p></div>;
  }

  const isHighValue = product.price >= 10000;
  const isOutOfStock = product.stock === 0;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6" data-testid="back-button">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product image placeholder */}
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl aspect-square flex items-center justify-center" data-testid="product-image">
          <Package size={64} className="text-slate-400" />
        </div>

        {/* Product info */}
        <div>
          <span className="text-sm font-medium text-cyan-600 capitalize">{product.category}</span>
          <h1 className="text-2xl font-bold mt-1 mb-2" data-testid="product-name">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4">
            <RatingStars rating={product.rating} />
            <span className="text-sm text-slate-500">({product.reviewCount} reviews)</span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 mb-6" data-testid="product-description">{product.description}</p>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-3xl font-bold" data-testid="product-price">{'\u00A3'}{(product.price / 100).toFixed(2)}</span>
            {isHighValue && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                <Shield size={12} /> Signature required
              </span>
            )}
          </div>

          {/* Stock info */}
          <p className={`text-sm mb-4 ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`} data-testid="stock-status">
            {isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={isOutOfStock || purchaseMutation.isPending}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-400 text-white font-medium py-3 px-6 rounded-lg transition-all"
            data-testid="buy-button"
          >
            <ShoppingBag size={18} />
            {purchaseMutation.isPending ? 'Processing...' : isOutOfStock ? 'Out of Stock' : 'Buy Now'}
          </button>

          {isHighValue && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              This is a high-value purchase. OHPP signature verification will be required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
