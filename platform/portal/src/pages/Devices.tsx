import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type DeviceInfo } from '../api/client'

export function Devices() {
  const queryClient = useQueryClient()
  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: api.getDevices,
  })

  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('cli')
  const [newToken, setNewToken] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => api.createDevice(newName, newType),
    onSuccess: (data) => {
      setNewToken(data.deviceToken)
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })

  if (isLoading) return <p className="text-gray-500">Loading devices...</p>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Register Device
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
          <h3 className="font-medium mb-3">Register new device</h3>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Device name"
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="cli">CLI</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
            </select>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
          {newToken && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm font-medium text-yellow-800 mb-1">Device token (shown once):</p>
              <code className="text-xs break-all bg-yellow-100 p-2 rounded block">{newToken}</code>
              <p className="text-xs text-yellow-600 mt-2">Copy this into your CLI or client app.</p>
            </div>
          )}
        </div>
      )}

      {devices?.length === 0 && <p className="text-gray-500">No devices registered.</p>}

      <div className="space-y-3">
        {devices?.map((device) => (
          <DeviceCard key={device.id} device={device} onDelete={() => deleteMutation.mutate(device.id)} />
        ))}
      </div>
    </div>
  )
}

function DeviceCard({ device, onDelete }: { device: DeviceInfo; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex justify-between items-center">
      <div>
        <p className="font-medium">{device.name}</p>
        <p className="text-sm text-gray-500">
          {device.deviceType} · {device.hasKey ? 'Key registered' : 'No key'}
          {!device.isActive && ' · Revoked'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Registered {new Date(device.registeredAt).toLocaleDateString()}
          {device.lastSeenAt && ` · Last seen ${new Date(device.lastSeenAt).toLocaleString()}`}
        </p>
      </div>
      <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-sm">Revoke</button>
    </div>
  )
}
