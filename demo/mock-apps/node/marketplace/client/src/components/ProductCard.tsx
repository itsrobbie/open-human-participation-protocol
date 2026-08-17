import { Package } from 'lucide-react';
import { RatingStars } from './RatingStars.tsx';

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

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors text-left group"
      data-testid={`product-card-${product.id}`}
    >
      {/* Image placeholder */}
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center relative">
        <Package size={32} className="text-slate-400 group-hover:text-cyan-500 transition-colors" />
        {isOutOfStock && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
            Out of Stock
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <span className="text-xs text-cyan-600 font-medium capitalize">{product.category}</span>
        <h3 className="font-medium mt-0.5 line-clamp-1">{product.name}</h3>
        <div className="flex items-center gap-1 mt-1">
          <RatingStars rating={product.rating} size="sm" />
          <span className="text-xs text-slate-500">({product.reviewCount})</span>
        </div>
        <p className="font-semibold mt-2">{'\u00A3'}{(product.price / 100).toFixed(2)}</p>
      </div>
    </button>
  );
}
