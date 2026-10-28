import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { setTokens } from '../auth/token'
import { Logo } from '../components/Logo'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Route through the resolver's broker so the IdP stays hidden (same model
      // as the app's in-app sign-in). The Portal never talks to Keycloak.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || body.error_description || 'Login failed. Check your credentials.')
        return
      }

      const data = await res.json()
      setTokens(data.accessToken, data.refreshToken)
      navigate({ to: '/' })
    } catch {
      setError('Could not reach the resolver.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Logo size={48} />
          <h1 className="text-xl font-bold mt-3 text-slate-900">OHPP Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to manage your participation.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email or username</label>
            <input
              type="text"
              data-testid="ohpp.login.username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="demo"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              data-testid="ohpp.login.password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="demo"
              required
            />
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 rounded px-3 py-2" data-testid="ohpp.login.error">{error}</div>
          )}

          <button
            type="submit"
            data-testid="ohpp.login.submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          data-testid="ohpp.login.create-account"
          onClick={() => navigate({ to: '/register' })}
          className="mt-4 w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Create an account
        </button>

        <p className="mt-4 text-xs text-slate-400 text-center">
          Demo account: <strong className="text-slate-600">demo</strong> / <strong className="text-slate-600">demo</strong>
        </p>
      </div>
    </div>
  )
}
