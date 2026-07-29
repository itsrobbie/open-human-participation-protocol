import { useState } from 'react'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../auth/token'

export function Settings() {
  const [token, setToken] = useState(getAccessToken() ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (token.trim()) {
      const existingRefresh = getRefreshToken()
      setTokens(token.trim(), existingRefresh ?? '')
    } else {
      clearTokens()
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Developer Settings</h1>
        <span className="text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full">Dev only</span>
      </div>

      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        This page is not visible in the navigation. Access it directly at <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded text-xs">/settings</code>.
      </p>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700 max-w-lg">
        <h2 className="font-semibold mb-4">Authentication</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Your session is managed automatically. The token below is refreshed in the background
          to keep you signed in. You only need to re-authenticate if your session expires after
          extended inactivity.
        </p>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Bearer Token</label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
          placeholder="eyJhbGciOiJ..."
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
          >
            Save
          </button>
          {saved && <span className="text-green-600 text-sm">Saved.</span>}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <h3 className="font-medium text-sm mb-2">Resolver Info</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            The Portal connects to the Resolver API at the same origin. In the Docker demo, both run behind the same host.
          </p>
        </div>
      </div>
    </div>
  )
}
