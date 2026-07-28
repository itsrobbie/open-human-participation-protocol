import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function Dashboard() {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['user-summary'],
    queryFn: api.getUserSummary,
  })

  if (isLoading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Failed to load dashboard. Check your device token in Settings.</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Devices" value={summary!.activeDevices} />
        <StatCard label="Connected Apps" value={summary!.activeApps} />
        <StatCard label="Pending Requests" value={summary!.pendingCount} />
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-2">Welcome, {summary!.displayName}</h2>
        <p className="text-gray-600 text-sm">{summary!.email}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}
