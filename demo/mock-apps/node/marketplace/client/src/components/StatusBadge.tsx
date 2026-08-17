const STATUS_STYLES: Record<string, string> = {
  pending_confirmation: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  confirmed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  shipped: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  delivered: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  refund_requested: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  refunded: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  submitted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  denied: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refund_requested: 'Refund Requested',
  refunded: 'Refunded',
  submitted: 'Submitted',
  approved: 'Approved',
  denied: 'Denied',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style}`} data-testid={`status-badge-${status}`}>
      {label}
    </span>
  );
}
