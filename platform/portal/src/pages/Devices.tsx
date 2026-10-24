import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type DeviceInfo } from '../api/client'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorState } from '../components/ErrorState'
import { ListSkeleton } from '../components/Skeleton'
import { formatRelativeTime } from '../utils/time'
import { EmptyState } from '../components/EmptyState'

export function Devices() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: devices, isLoading, error, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: api.getDevices,
  })

  const [newToken, setNewToken] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null)
  const createInFlight = useRef(false)

  const createBrowserDevice = useMutation({
    mutationFn: () => api.createDevice('This browser', 'browser'),
    onSuccess: (data) => {
      setNewToken(data.deviceToken)
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast('Browser registered for web approvals.', 'success')
    },
    onError: () => toast('Failed to register browser.', 'error'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.deleteDevice(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['devices'] })
      const previous = queryClient.getQueryData<DeviceInfo[]>(['devices'])
      queryClient.setQueryData<DeviceInfo[]>(
        ['devices'],
        (old) => old?.map((d) => d.id === id ? { ...d, isActive: false } : d) ?? []
      )
      return { previous }
    },
    onSuccess: () => {
      toast('Device revoked.', 'success')
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['devices'], context.previous)
      }
      toast('Failed to revoke device.', 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

  const registerBrowser = () => {
    if (createInFlight.current) return
    createInFlight.current = true
    createBrowserDevice.mutate(undefined, {
      onSettled: () => { createInFlight.current = false },
    })
  }

  if (isLoading) return <ListSkeleton count={3} />
  if (error) return <ErrorState message="Failed to load devices." onRetry={() => refetch()} />

  const activeDevices = devices?.filter((d) => d.isActive) ?? []
  const revokedDevices = devices?.filter((d) => !d.isActive) ?? []
  const hasBrowserDevice = activeDevices.some((d) => d.deviceType === 'browser' || d.deviceType === 'desktop')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" data-testid="ohpp.devices.heading">Devices</h1>
      <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
        Devices are where you approve participation requests. Register this browser to approve requests here, or use the CLI/mobile app on another device.
      </p>

      {/* Primary action: Enable web approvals */}
      {!hasBrowserDevice && activeDevices.length === 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2">Enable web approvals</h2>
          <p className="text-indigo-700 dark:text-indigo-300 text-sm mb-4">
            Register this browser as your approval device. Once registered, you can approve or deny
            participation requests directly on the Pending page — no separate app needed.
          </p>
          <button
            data-testid="ohpp.devices.enable-web-approvals"
            onClick={registerBrowser}
            disabled={createBrowserDevice.isPending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {createBrowserDevice.isPending ? 'Registering...' : 'Enable web approvals'}
          </button>
        </div>
      )}

      {/* Token shown after browser registration */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Browser registered</p>
          <p className="text-sm text-green-700 dark:text-green-300">
            Web approvals are now enabled. Go to the <strong>Pending</strong> page to approve requests.
          </p>
        </div>
      )}

      {/* Empty state */}
      {activeDevices.length === 0 && revokedDevices.length === 0 && !newToken && (
        <EmptyState
          icon="devices"
          title="No devices registered"
          description="Register this browser above to start approving requests. CLI and mobile devices are registered from those apps directly."
        />
      )}

      {activeDevices.length === 0 && revokedDevices.length > 0 && (
        <p className="text-gray-500 dark:text-slate-400 mb-6">No active devices.</p>
      )}

      {/* Active devices */}
      {activeDevices.length > 0 && (
        <div className="space-y-3 mb-8">
          {activeDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onRevoke={() => setRevokeTarget(device)}
              isRevoking={revokeMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Revoked devices */}
      {revokedDevices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-500 dark:text-slate-400 mb-3">Revoked</h2>
          <div className="space-y-3">
            {revokedDevices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      {/* Info box about other device types */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Other device types</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          CLI and mobile devices register themselves when you run the CLI tool or install the OHPP mobile app.
          They'll appear here automatically once connected. You don't need to register them from this browser.
        </p>
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
        title="Revoke device"
        description={`Are you sure you want to revoke "${revokeTarget?.name}"? This cannot be undone. The device will no longer be able to approve participation requests.`}
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
        }}
      />
    </div>
  )
}

function DeviceCard({
  device,
  onRevoke,
  isRevoking,
}: {
  device: DeviceInfo
  onRevoke?: () => void
  isRevoking?: boolean
}) {
  const typeLabel: Record<string, string> = {
    browser: 'Web browser',
    desktop: 'Desktop',
    mobile: 'Mobile',
    cli: 'CLI',
  }

  return (
    <div
      data-testid={`ohpp.devices.card.${device.id}`}
      className={`rounded-lg p-4 shadow-sm dark:shadow-slate-900/20 border flex justify-between items-center ${
        device.isActive
          ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
          : 'bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-700'
      }`}
    >
      <div>
        <p className={`font-medium ${!device.isActive ? 'text-gray-700 dark:text-slate-300' : ''}`}>{device.name}</p>
        <p className={`text-sm ${!device.isActive ? 'text-gray-600 dark:text-slate-400' : 'text-gray-500 dark:text-slate-400'}`}>
          {typeLabel[device.deviceType] ?? device.deviceType}
          {device.hasKey && ' · Key registered'}
          {!device.isActive && (
            <span className="text-red-700 dark:text-red-400 font-medium"> · Revoked</span>
          )}
        </p>
        <p className={`text-xs mt-1 ${!device.isActive ? 'text-gray-700 dark:text-slate-300' : 'text-gray-600 dark:text-slate-300'}`}>
          Registered {formatRelativeTime(device.registeredAt)}
          {device.lastSeenAt && ` · Last seen ${formatRelativeTime(device.lastSeenAt)}`}
        </p>
      </div>
      {device.isActive && onRevoke && (
        <button
          data-testid={`ohpp.devices.revoke.${device.id}`}
          onClick={onRevoke}
          disabled={isRevoking}
          aria-label={`Revoke ${device.name}`}
          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
        >
          Revoke
        </button>
      )}
    </div>
  )
}
