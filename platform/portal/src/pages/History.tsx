import { useQuery } from '@tanstack/react-query'
import { api, type HistoryEntry } from '../api/client'

export function History() {
  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.getHistory(1, 50),
  })

  if (isLoading) return <p className="text-gray-500">Loading history...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Participation History</h1>

      {data?.items.length === 0 && (
        <p className="text-gray-500">No participation records yet.</p>
      )}

      <div className="space-y-3">
        {data?.items.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const statusColor = {
    Resolved: 'bg-green-100 text-green-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    Expired: 'bg-gray-100 text-gray-800',
    Cancelled: 'bg-red-100 text-red-800',
  }[entry.status] ?? 'bg-gray-100 text-gray-800'

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex justify-between items-start">
      <div>
        <p className="font-medium">{entry.actionSummary}</p>
        <p className="text-sm text-gray-500 mt-1">
          {entry.appName} ({entry.appId}) · {entry.type}
          {entry.category && ` · ${entry.category}`}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(entry.createdAt).toLocaleString()}
          {entry.resolvedAt && ` → ${new Date(entry.resolvedAt).toLocaleString()}`}
        </p>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
        {entry.status}
      </span>
    </div>
  )
}
