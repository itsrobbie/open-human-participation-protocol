import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type RegisteredApp } from '../api/client'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorState } from '../components/ErrorState'
import { ListSkeleton } from '../components/Skeleton'
import { formatRelativeTime } from '../utils/time'
import { EmptyState } from '../components/EmptyState'

export function Apps() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [revokeTarget, setRevokeTarget] = useState<RegisteredApp | null>(null)
  const { data: apps, isLoading, error, refetch } = useQuery({
    queryKey: ['registered-apps'],
    queryFn: api.getRegisteredApps,
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeApp(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['registered-apps'] })
      const previous = queryClient.getQueryData<RegisteredApp[]>(['registered-apps'])
      queryClient.setQueryData<RegisteredApp[]>(
        ['registered-apps'],
        (old) => old?.map((a) => a.id === id ? { ...a, isActive: false, revokedAt: new Date().toISOString() } : a) ?? []
      )
      return { previous }
    },
    onSuccess: () => {
      toast('App revoked.', 'success')
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['registered-apps'], context.previous)
      }
      toast('Failed to revoke app. It may have been already revoked.', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['registered-apps'] })
    },
  })

  if (isLoading) return <ListSkeleton count={2} />
  if (error) return <ErrorState message="Failed to load apps." onRetry={() => refetch()} />

  const activeApps = apps?.filter((a) => a.isActive) ?? []
  const revokedApps = apps?.filter((a) => !a.isActive) ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Registered Apps</h1>

      <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
        These apps have registered with your account and can send participation requests.
      </p>

      {activeApps.length === 0 && revokedApps.length === 0 && (
        <EmptyState
          icon="apps"
          title="No apps connected"
          description="Connect an app to start receiving participation requests. The app will give you a connection link to paste here."
          actionLabel="Connect an app"
          actionTo="/register-app"
        />
      )}

      {activeApps.length === 0 && revokedApps.length > 0 && (
        <p className="text-gray-500 dark:text-slate-400 mb-6">No active apps.</p>
      )}

      {activeApps.length > 0 && (
        <div className="space-y-3 mb-8">
          {activeApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onRevoke={() => setRevokeTarget(app)}
              isRevoking={revokeMutation.isPending}
            />
          ))}
        </div>
      )}

      {revokedApps.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-500 dark:text-slate-400 mb-3">Revoked</h2>
          <div className="space-y-3 opacity-60">
            {revokedApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
        title="Revoke app"
        description={`Are you sure you want to revoke "${revokeTarget?.appName}"? This app will no longer be able to send you participation requests. This cannot be undone.`}
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
        }}
      />
    </div>
  )
}

function AppCard({
  app,
  onRevoke,
  isRevoking,
}: {
  app: RegisteredApp
  onRevoke?: () => void
  isRevoking?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-4 shadow-sm dark:shadow-slate-900/20 border flex justify-between items-center ${
        app.isActive
          ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
          : 'bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-700'
      }`}
    >
      <div>
        <p className={`font-medium ${!app.isActive ? 'text-gray-400 dark:text-slate-500' : ''}`}>{app.appName}</p>
        <p className="text-sm text-gray-500 dark:text-slate-400">{app.appId}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Registered {formatRelativeTime(app.registeredAt)}
          {!app.isActive && app.revokedAt && (
            <span className="text-red-500 font-medium"> · Revoked {formatRelativeTime(app.revokedAt)}</span>
          )}
        </p>
      </div>
      {app.isActive && onRevoke && (
        <button
          onClick={onRevoke}
          disabled={isRevoking}
          aria-label={`Revoke ${app.appName}`}
          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
        >
          Revoke
        </button>
      )}
    </div>
  )
}
