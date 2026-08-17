import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';
import { StepProgress } from '../components/StepProgress.tsx';
import { CountdownTimer } from '../components/CountdownTimer.tsx';

interface OhppPizzaFlow {
  id: string;
  transactionId: string;
  currentStep: number;
  totalSteps: number;
  status: string;
  selections: Record<string, unknown>;
  createdAt: string;
}

interface FlowResponse {
  flow: OhppPizzaFlow;
  order?: { id: string };
}

const STEP_NAMES = [
  'Choose Pizza',
  'Select Size',
  'Extra Toppings',
  'Special Instructions',
  'Delivery Date',
  'Add Tip',
  'Confirm Order',
];

export function OhppPizzaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check for active flow
  const { data: flowData, isLoading } = useQuery({
    queryKey: ['ohpp-pizza-flow'],
    queryFn: () => api.get<FlowResponse>('/api/orders/ohpp-pizza/status').catch(() => null),
    refetchInterval: 5000,
  });

  const startFlow = useMutation({
    mutationFn: () => api.post<FlowResponse>('/api/orders/ohpp-pizza'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ohpp-pizza-flow'] });
      toast.success('OHPP Pizza flow started! Check your device.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const advanceFlow = useMutation({
    mutationFn: (flowId: string) => api.post<FlowResponse>(`/api/orders/ohpp-pizza/${flowId}/advance`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ohpp-pizza-flow'] });
      if (data?.order) {
        toast.success('Pizza ordered successfully!');
        navigate(`/orders/${data.order.id}`);
      }
    },
  });

  const cancelFlow = useMutation({
    mutationFn: (flowId: string) => api.post<FlowResponse>(`/api/orders/ohpp-pizza/${flowId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ohpp-pizza-flow'] });
      toast.info('Order cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const flow = flowData?.flow;
  const hasActiveFlow = flow && flow.status === 'in_progress';

  // Auto-advance polling
  if (hasActiveFlow && flow.id) {
    // The refetchInterval on the query handles polling.
    // We attempt advance on each poll to check if the current step resolved.
    if (!advanceFlow.isPending) {
      advanceFlow.mutate(flow.id);
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-stone-100 dark:bg-stone-800 rounded-lg" />;
  }

  // No active flow - show start button
  if (!hasActiveFlow) {
    const isCompleted = flow?.status === 'completed';
    const isCancelled = flow?.status === 'cancelled' || flow?.status === 'expired';

    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚡</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">OHPP Pizza</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6">
          Order your pizza step-by-step via OHPP. Each decision arrives on your device.
        </p>

        {isCancelled && (
          <p className="text-amber-600 dark:text-amber-400 text-sm mb-4" data-testid="flow-cancelled-message">
            Your last flow was cancelled. Start a new one when you're ready.
          </p>
        )}

        {isCompleted && (
          <p className="text-green-600 dark:text-green-400 text-sm mb-4" data-testid="flow-completed-message">
            Order placed! Check your order history.
          </p>
        )}

        <button
          onClick={() => startFlow.mutate()}
          disabled={startFlow.isPending}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
          data-testid="start-ohpp-pizza"
        >
          {startFlow.isPending ? 'Starting...' : 'Start OHPP Pizza Order'}
        </button>
      </div>
    );
  }

  // Active flow - show progress
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OHPP Pizza Order</h1>

      {/* Step Progress */}
      <StepProgress currentStep={flow.currentStep} totalSteps={flow.totalSteps} stepNames={STEP_NAMES} />

      {/* Current Step Card */}
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6 mt-6" data-testid="current-step-card">
        <h2 className="font-semibold text-lg mb-2">Step {flow.currentStep}: {STEP_NAMES[flow.currentStep - 1]}</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
          <p className="text-stone-500 dark:text-stone-400 text-sm">Waiting for your response on your device...</p>
        </div>
        <CountdownTimer startedAt={flow.createdAt} durationMs={flow.currentStep === 1 ? 15 * 60 * 1000 : 10 * 60 * 1000} />
      </div>

      {/* Selections so far */}
      {Object.keys(flow.selections).length > 0 && (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6 mt-4" data-testid="flow-selections">
          <h3 className="font-medium mb-3">Your choices so far</h3>
          <dl className="space-y-2 text-sm">
            {flow.selections.pizzaName ? <div className="flex justify-between"><dt className="text-stone-500">Pizza</dt><dd>{String(flow.selections.pizzaName)}</dd></div> : null}
            {flow.selections.size ? <div className="flex justify-between"><dt className="text-stone-500">Size</dt><dd>{String(flow.selections.size)}</dd></div> : null}
            {Array.isArray(flow.selections.toppings) && (flow.selections.toppings as string[]).length > 0 ? (
              <div className="flex justify-between"><dt className="text-stone-500">Toppings</dt><dd>{(flow.selections.toppings as string[]).join(', ')}</dd></div>
            ) : null}
          </dl>
        </div>
      )}

      {/* Cancel button */}
      <div className="mt-6 text-center">
        <button
          onClick={() => cancelFlow.mutate(flow.id)}
          disabled={cancelFlow.isPending}
          className="text-stone-500 hover:text-red-600 text-sm"
          data-testid="cancel-ohpp-pizza"
        >
          Cancel order
        </button>
      </div>
    </div>
  );
}
