import { useState } from 'react'
import { ensureFreshToken } from '../auth/token'
import { useToast } from '../components/Toast'
import { useQueryClient } from '@tanstack/react-query'

export function RegisterApp() {
  const [uri, setUri] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleRegister = async () => {
    if (!uri.trim()) return
    setStatus('processing')
    setMessage('Processing challenge...')

    try {
      const token = await ensureFreshToken()

      let challengePayload = uri.trim()
      if (challengePayload.includes('challenge=')) {
        const url = new URL(challengePayload.replace('ohpp://', 'http://ohpp/'))
        challengePayload = url.searchParams.get('challenge') ?? challengePayload
      }

      const res = await fetch('/api/registrations/process-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ challengePayload }),
      })

      if (res.ok) {
        setStatus('success')
        setMessage('App registered successfully. It can now send you participation requests.')
        setUri('')
        toast('App registered successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['registered-apps'] })
        queryClient.invalidateQueries({ queryKey: ['user-summary'] })
      } else {
        const body = await res.text()
        setStatus('error')
        setMessage(`Registration failed: ${body}`)
        toast('Registration failed.', 'error')
      }
    } catch {
      setStatus('error')
      setMessage('Could not reach the Resolver.')
      toast('Could not reach the Resolver.', 'error')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" data-testid="ohpp.registerapp.heading">Connect an app</h1>
      <p className="text-gray-600 dark:text-slate-400 text-sm mb-6">
        When an app wants to request your participation (approvals, confirmations, signatures), it needs to
        connect to your account first. The app will give you a connection link — paste it below.
      </p>

      {/* How it works */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-5 border border-gray-200 dark:border-slate-700 mb-6 max-w-lg">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">How it works</h2>
        <ol className="text-sm text-gray-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
          <li>The app generates a connection link (starts with <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded text-xs">ohpp://</code>)</li>
          <li>You paste it below and click Connect</li>
          <li>The app is now linked to your account and can send you requests</li>
          <li>You approve or deny those requests on the <strong>Pending</strong> page</li>
        </ol>
      </div>

      {/* Connection form */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700 max-w-lg">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Connection link</label>
        <textarea
          data-testid="ohpp.registerapp.uri"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
          placeholder="ohpp://register?challenge=eyJ..."
        />
        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
          Look for a "Connect to OHPP" or "Generate connection link" button in the app you want to connect.
        </p>

        <button
          data-testid="ohpp.registerapp.connect"
          onClick={handleRegister}
          disabled={!uri.trim() || status === 'processing'}
          className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'processing' ? 'Connecting...' : 'Connect app'}
        </button>

        {status === 'success' && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-3 text-sm text-green-800 dark:text-green-200" data-testid="ohpp.registerapp.success">
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-800 dark:text-red-200" data-testid="ohpp.registerapp.error">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
