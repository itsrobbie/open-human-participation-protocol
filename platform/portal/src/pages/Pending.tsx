import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ensureFreshToken } from '../auth/token'
import { useToast } from '../components/Toast'
import { ErrorState } from '../components/ErrorState'
import { PendingSkeleton } from '../components/Skeleton'
import { formatRelativeTime, formatDateTime } from '../utils/time'
import { EmptyState } from '../components/EmptyState'

// --- Types matching the enriched API response ---

interface WebApprovalsStatus {
  enabled: boolean
  reason: string | null
}

interface RequestOption {
  key: string
  label: string
}

interface PendingRequest {
  id: string
  appId: string
  actionSummary: string
  description: string | null
  rationale: string | null
  type: string
  options: RequestOption[] | null
  placeholder: string | null
  masked: boolean
  keyboard: string | null
  expiresAt: string | null
  createdAt: string
}

interface ResolvePayload {
  requestId: string
  selectedOption?: string
  selectedOptions?: string[]
  value?: string
}

// --- API calls ---

async function getWebApprovalsStatus(): Promise<WebApprovalsStatus> {
  const token = await ensureFreshToken()
  const res = await fetch('/api/web-approvals/status', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}

async function getPendingRequests(): Promise<PendingRequest[]> {
  const token = await ensureFreshToken()
  const res = await fetch('/api/web-approvals/pending', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch pending')
  return res.json()
}

async function resolveRequest(payload: ResolvePayload): Promise<void> {
  const token = await ensureFreshToken()
  const { requestId, ...body } = payload
  const res = await fetch(`/api/web-approvals/${requestId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(errorBody || 'Failed to resolve')
  }
}

// --- Page component ---

export function Pending() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery({
    queryKey: ['web-approvals-status'],
    queryFn: getWebApprovalsStatus,
  })

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['web-approvals-pending'],
    queryFn: getPendingRequests,
    enabled: status?.enabled === true,
    refetchInterval: 3000,
  })

  const resolveMutation = useMutation({
    mutationFn: (payload: ResolvePayload) => resolveRequest(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['web-approvals-pending'] })
      const previous = queryClient.getQueryData<PendingRequest[]>(['web-approvals-pending'])
      queryClient.setQueryData<PendingRequest[]>(
        ['web-approvals-pending'],
        (old) => old?.filter((r) => r.id !== payload.requestId) ?? []
      )
      return { previous }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
      toast('Response submitted.', 'success')
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['web-approvals-pending'], context.previous)
      }
      toast('Failed to submit response.', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['web-approvals-pending'] })
    },
  })

  if (statusLoading) return <PendingSkeleton />
  if (statusError) return <ErrorState message="Failed to load approval status." onRetry={() => refetchStatus()} />

  if (!status?.enabled) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Pending Requests</h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
          <h2 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Web approvals disabled</h2>
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            You have a registered device with a key. Respond to requests from your device instead.
          </p>
          <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
            Web responses are only available when no devices with keys are connected — this prevents
            agents from responding through the browser.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pending Requests</h1>
      <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
        Respond to participation requests directly in the browser.
      </p>

      {pendingLoading && <PendingSkeleton />}

      {pending?.length === 0 && (
        <EmptyState
          icon="pending"
          title="No pending requests"
          description="Requests will appear here when apps need your participation."
        />
      )}

      <div className="space-y-4" aria-live="polite" aria-relevant="additions removals">
        {pending?.map((req) => (
          <RequestCard
            key={req.id}
            request={req}
            onResolve={(payload) => resolveMutation.mutate(payload)}
            isResolving={resolveMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}

// --- Request card: renders type-specific UI ---

function RequestCard({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  return (
    <div
      data-testid={`pending-${request.type.toLowerCase()}`}
      className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3">
          <RequestTypeIcon type={request.type} />
          <div>
            <p className="font-medium text-lg">{request.actionSummary}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              From: <span className="font-mono text-xs">{request.appId}</span>
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-600 dark:text-slate-300">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>

      {/* Description (from the requesting app) */}
      {request.description && (
        <p className="text-sm text-gray-700 dark:text-slate-300 mb-3 whitespace-pre-line">
          {request.description}
        </p>
      )}

      {/* Rationale */}
      {request.rationale && (
        <p className="text-xs text-gray-500 dark:text-slate-400 italic mb-3">
          {request.rationale}
        </p>
      )}

      {request.expiresAt && (
        <p className="text-xs text-orange-700 dark:text-orange-400 mb-3">
          Expires: {formatDateTime(request.expiresAt)}
        </p>
      )}

      {/* Type-specific response UI */}
      <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
        <ResponseInput
          request={request}
          onResolve={onResolve}
          isResolving={isResolving}
        />
      </div>
    </div>
  )
}

// --- Type-specific response inputs ---

function ResponseInput({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  const type = request.type.toLowerCase()

  if (type === 'select' && request.options && request.options.length > 0) {
    return <SelectResponse request={request} onResolve={onResolve} isResolving={isResolving} />
  }

  if (type === 'multiselect' && request.options && request.options.length > 0) {
    return <MultiselectResponse request={request} onResolve={onResolve} isResolving={isResolving} />
  }

  if (type === 'text' || type === 'number' || type === 'date' || type === 'datetime') {
    return <InputResponse request={request} onResolve={onResolve} isResolving={isResolving} />
  }

  if (type === 'signature') {
    return <SignatureResponse request={request} onResolve={onResolve} isResolving={isResolving} />
  }

  // Fallback for unknown types — show a text input
  return <InputResponse request={request} onResolve={onResolve} isResolving={isResolving} />
}

function SelectResponse({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {request.options!.map((option) => (
        <button
          key={option.key}
          data-testid={`ohpp.pending.option.${option.key}`}
          onClick={() => onResolve({ requestId: request.id, selectedOption: option.key })}
          disabled={isResolving}
          className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MultiselectResponse({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        {request.options!.map((option) => (
          <label key={option.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              data-testid={`ohpp.pending.multioption.${option.key}`}
              checked={selected.includes(option.key)}
              onChange={() => toggle(option.key)}
              className="rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700 dark:text-slate-300">{option.label}</span>
          </label>
        ))}
      </div>
      <button
        data-testid="ohpp.pending.multiselect.submit"
        onClick={() => onResolve({ requestId: request.id, selectedOptions: selected })}
        disabled={isResolving || selected.length === 0}
        className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        Submit
      </button>
    </div>
  )
}

function InputResponse({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  const [value, setValue] = useState('')

  const inputType = request.type.toLowerCase() === 'number' ? 'number'
    : request.type.toLowerCase() === 'date' ? 'date'
    : request.type.toLowerCase() === 'datetime' ? 'datetime-local'
    : 'text'

  return (
    <div className="flex gap-2">
      <input
        type={inputType}
        data-testid="ohpp.pending.input.field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={request.placeholder ?? 'Your response...'}
        className="flex-1 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
      />
      <button
        data-testid="ohpp.pending.input.submit"
        onClick={() => onResolve({ requestId: request.id, value })}
        disabled={isResolving || !value.trim()}
        className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        Submit
      </button>
    </div>
  )
}

function SignatureResponse({
  request,
  onResolve,
  isResolving,
}: {
  request: PendingRequest
  onResolve: (payload: ResolvePayload) => void
  isResolving: boolean
}) {
  return (
    <button
      data-testid="ohpp.pending.signature.submit"
      onClick={() => onResolve({ requestId: request.id, value: 'acknowledged' })}
      disabled={isResolving}
      className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
    >
      I acknowledge
    </button>
  )
}

// --- Request type icons ---

const typeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  select: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    label: 'Select',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  multiselect: {
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    label: 'Multi',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  text: {
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    label: 'Text',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  number: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    label: '#',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  signature: {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    label: 'Sign',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  date: {
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    label: 'Date',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  datetime: {
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    label: 'DateTime',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

function RequestTypeIcon({ type }: { type: string }) {
  const config = typeConfig[type] ?? {
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    label: type,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  return (
    <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${config.color}`} title={config.label}>
      {config.icon}
    </div>
  )
}
