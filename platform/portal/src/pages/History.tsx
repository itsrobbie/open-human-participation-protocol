import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type HistoryEntry } from '../api/client'
import { ErrorState } from '../components/ErrorState'
import { ListSkeleton } from '../components/Skeleton'
import { formatRelativeTime, formatDateTime } from '../utils/time'
import { EmptyState } from '../components/EmptyState'

const PAGE_SIZE = 20

export function History() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['history', page],
    queryFn: () => api.getHistory(page, PAGE_SIZE),
  })

  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    let items = data.items

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (e) =>
          e.actionSummary.toLowerCase().includes(q) ||
          e.appName.toLowerCase().includes(q) ||
          e.appId.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      items = items.filter((e) => e.status === statusFilter)
    }

    return items
  }, [data?.items, search, statusFilter])

  if (isLoading) return <ListSkeleton count={4} />
  if (error) return <ErrorState message="Failed to load history." onRetry={() => refetch()} />

  const totalPages = Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE)
  const hasFilters = search.trim() !== '' || statusFilter !== 'all'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Participation History</h1>

      {/* Search and filter bar */}
      {(data?.items.length ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by app or action..."
            className="flex-1 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
          />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="Resolved">Resolved</option>
            <option value="Pending">Pending</option>
            <option value="Expired">Expired</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      )}

      {data?.items.length === 0 && !hasFilters && (
        <EmptyState
          icon="history"
          title="No participation records yet"
          description="Once apps send you participation requests and you respond, your history will appear here."
        />
      )}

      {hasFilters && filteredItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-slate-400 text-sm">No results match your filters.</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all') }}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filteredItems.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const statusColor = {
    Resolved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    Pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    Expired: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200',
    Cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  }[entry.status] ?? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700 flex justify-between items-start">
      <div>
        <p className="font-medium">{entry.actionSummary}</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {entry.appName} ({entry.appId}) · {entry.type}
          {entry.category && ` · ${entry.category}`}
        </p>
        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
          {formatRelativeTime(entry.createdAt)}
          {entry.resolvedAt && ` → ${formatDateTime(entry.resolvedAt)}`}
        </p>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
        {entry.status}
      </span>
    </div>
  )
}
