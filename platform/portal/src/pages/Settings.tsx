import { useState } from 'react'

export function Settings() {
  const [token, setToken] = useState(localStorage.getItem('ohpp_device_token') ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem('ohpp_device_token', token.trim())
    } else {
      localStorage.removeItem('ohpp_device_token')
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 max-w-lg">
        <h2 className="font-semibold mb-4">Authentication</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your identity provider token (JWT) to authenticate with the Resolver.
          This token is stored in your browser's local storage.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="eyJhbGciOiJ..."
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Save
          </button>
          {saved && <span className="text-green-600 text-sm">Saved.</span>}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="font-medium text-sm mb-2">Resolver Info</h3>
          <p className="text-xs text-gray-500">
            The Portal connects to the Resolver API at the same origin. In the Docker demo, both run behind the same host.
          </p>
        </div>
      </div>
    </div>
  )
}
