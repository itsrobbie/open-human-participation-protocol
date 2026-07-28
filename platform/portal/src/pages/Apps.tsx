import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type RegisteredApp } from '../api/client'

export function Apps() {
  const queryClient = useQueryClient()
  const { data: apps, isLoading } = useQuery({
    queryKey: ['registered-apps'],
    queryFn: api.getRegisteredApps,
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeApp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registered-apps'] }),
  })

  if (isLoading) return <p className="text-gray-500">Loading apps...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Registered Apps</h1>

      <p className="text-gray-600 text-sm mb-4">
        These apps have registered with your account and can send participation requests.
      </p>

      {apps?.length === 0 && (
        <p className="text-gray-500">No apps registered. Register an app by scanning a challenge QR code or pasting a registration URI.</p>
      )}

      <div className="space-y-3">
        {apps?.map((app) => (
          <AppCard key={app.id} app={app} onRevoke={() => revokeMutation.mutate(app.id)} />
        ))}
      </div>
    </div>
  )
}

function AppCard({ app, onRevoke }: { app: RegisteredApp; onRevoke: () => void }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex justify-between items-center">
      <div>
        <p className="font-medium">{app.appName}</p>
        <p className="text-sm text-gray-500">{app.appId}</p>
        <p className="text-xs text-gray-400 mt-1">
          Registered {new Date(app.registeredAt).toLocaleDateString()}
        </p>
      </div>
      <button onClick={onRevoke} className="text-red-600 hover:text-red-800 text-sm">Revoke</button>
    </div>
  )
}
