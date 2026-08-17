import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md';
}

export function RatingStars({ rating, size = 'md' }: RatingStarsProps) {
  const starSize = size === 'sm' ? 12 : 16;
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i;
    const halfFilled = !filled && rating >= i - 0.5;

    stars.push(
      <Star
        key={i}
        size={starSize}
        className={
          filled
            ? 'text-amber-400 fill-amber-400'
            : halfFilled
              ? 'text-amber-400 fill-amber-400/50'
              : 'text-slate-300 dark:text-slate-600'
        }
      />,
    );
  }

  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`} data-testid="rating-stars">
      {stars}
    </div>
  );
}
