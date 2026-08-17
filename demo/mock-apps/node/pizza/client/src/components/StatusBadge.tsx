const STATUS_STYLES: Record<string, string> = {
  pending_confirmation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ohpp_pizza_in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  out_for_delivery: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Pending',
  ohpp_pizza_in_progress: 'In Progress',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300';
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${style}`} data-testid={`status-badge-${status}`}>
      {label}
    </span>
  );
}
