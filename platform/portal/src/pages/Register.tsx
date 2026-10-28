import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { setTokens } from '../auth/token'
import { Logo } from '../components/Logo'

/// Native Portal sign-up. Creates an account through the resolver's /api/auth
/// broker (the IdP stays hidden, same model as the app's in-app sign-up) and
/// signs the user straight in on success.
export function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setError('An account with that username or email already exists.')
        } else {
          setError(body.error || 'Could not create the account. Check the details and try again.')
        }
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
          <h1 className="text-xl font-bold mt-3 text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Sign up to manage your participation.</p>
        </div>

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              data-testid="ohpp.register.username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              data-testid="ohpp.register.email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              data-testid="ohpp.register.password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 rounded px-3 py-2" data-testid="ohpp.register.error">{error}</div>
          )}

          <button
            type="submit"
            data-testid="ohpp.register.submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          data-testid="ohpp.register.back-to-login"
          onClick={() => navigate({ to: '/login' })}
          className="mt-4 w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  )
}
