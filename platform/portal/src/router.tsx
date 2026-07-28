import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
} from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Devices } from './pages/Devices'
import { Apps } from './pages/Apps'
import { Settings } from './pages/Settings'

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-8">
          <span className="font-bold text-lg">OHPP Portal</span>
          <div className="flex gap-6 text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900 [&.active]:text-blue-600 [&.active]:font-medium">Dashboard</Link>
            <Link to="/history" className="text-gray-600 hover:text-gray-900 [&.active]:text-blue-600 [&.active]:font-medium">History</Link>
            <Link to="/devices" className="text-gray-600 hover:text-gray-900 [&.active]:text-blue-600 [&.active]:font-medium">Devices</Link>
            <Link to="/apps" className="text-gray-600 hover:text-gray-900 [&.active]:text-blue-600 [&.active]:font-medium">Apps</Link>
            <Link to="/settings" className="text-gray-600 hover:text-gray-900 [&.active]:text-blue-600 [&.active]:font-medium">Settings</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  ),
})

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard })
const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/history', component: History })
const devicesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/devices', component: Devices })
const appsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/apps', component: Apps })
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings })

const routeTree = rootRoute.addChildren([indexRoute, historyRoute, devicesRoute, appsRoute, settingsRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
