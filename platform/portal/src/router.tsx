import { useEffect, useState } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  redirect,
} from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Devices } from './pages/Devices'
import { Apps } from './pages/Apps'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { Pending } from './pages/Pending'
import { RegisterApp } from './pages/RegisterApp'
import { ProtocolLab } from './pages/ProtocolLab'
import { api } from './api/client'
import { hasValidSession, clearTokens, startTokenRefreshTimer } from './auth/token'
import { Logo } from './components/Logo'
import { ThemeToggle } from './components/ThemeToggle'

const protocolLabEnabled = import.meta.env.VITE_ENABLE_PROTOCOL_LAB === 'true'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

function AuthenticatedLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Start the background token refresh timer when authenticated
  useEffect(() => {
    const stopRefresh = startTokenRefreshTimer()
    return stopRefresh
  }, [])

  const navLinks = [
    { to: '/' as const, label: 'Dashboard' },
    { to: '/pending' as const, label: 'Pending' },
    { to: '/history' as const, label: 'History' },
    { to: '/devices' as const, label: 'Devices' },
    { to: '/apps' as const, label: 'Apps' },
    { to: '/register-app' as const, label: 'Connect App' },
    ...(protocolLabEnabled ? [{ to: '/protocol-lab' as const, label: 'Protocol Lab' }] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <nav className="bg-brand-dark border-b border-slate-700 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="ohpp.nav.home" onClick={() => setMobileMenuOpen(false)}>
            <Logo size={28} />
            <span className="font-bold text-lg text-white">OHPP</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                data-testid={`ohpp.nav.link.${link.to}`}
                className="text-slate-300 hover:text-white [&.active]:text-brand-accent [&.active]:font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <button
              data-testid="ohpp.nav.logout"
              onClick={() => { clearTokens(); window.location.href = '/login' }}
              className="text-sm text-slate-400 hover:text-white"
            >
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            data-testid="ohpp.nav.mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white p-1"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-slate-700">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  data-testid={`ohpp.nav.link.${link.to}`}
                  className="text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm [&.active]:text-brand-accent [&.active]:font-medium [&.active]:bg-slate-800"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <button
                data-testid="ohpp.nav.logout-mobile"
                onClick={() => { clearTokens(); window.location.href = '/login' }}
                className="text-left text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm mt-2 border-t border-slate-700 pt-3"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

const authenticatedLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async () => {
    if (!hasValidSession()) {
      throw redirect({ to: '/login' })
    }
    // Ensure user exists in the resolver (idempotent — creates on first call)
    try {
      await api.createUser()
    } catch {
      // Non-fatal: user may already exist or resolver briefly unavailable
    }
  },
  component: AuthenticatedLayout,
})

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login })
const indexRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/', component: Dashboard })
const pendingRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/pending', component: Pending })
const historyRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/history', component: History })
const devicesRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/devices', component: Devices })
const appsRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/apps', component: Apps })
const registerAppRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/register-app', component: RegisterApp })
const settingsRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/settings', component: Settings })
const protocolLabRoute = createRoute({ getParentRoute: () => authenticatedLayout, path: '/protocol-lab', component: ProtocolLab })

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedLayout.addChildren([
    indexRoute,
    pendingRoute,
    historyRoute,
    devicesRoute,
    appsRoute,
    registerAppRoute,
    settingsRoute,
    ...(protocolLabEnabled ? [protocolLabRoute] : []),
  ]),
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div className="p-8 text-center" data-testid="ohpp.notfound">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-600 dark:text-slate-400 text-sm">
        The page you are looking for does not exist.
      </p>
    </div>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
