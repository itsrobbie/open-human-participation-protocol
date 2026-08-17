import { Shield } from 'lucide-react';

export function SignatureBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
      data-testid="signature-badge"
    >
      <Shield size={12} />
      Signed
    </span>
  );
}
