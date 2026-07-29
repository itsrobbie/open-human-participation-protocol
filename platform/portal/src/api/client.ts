import createClient from 'openapi-fetch'
import type { paths } from './schema'
import { ensureFreshToken, refreshAccessToken, clearTokens } from '../auth/token'

/**
 * Typed API client generated from the Resolver's OpenAPI spec (swagger.json).
 *
 * Request types (paths, params, bodies) are fully typed from the spec.
 * Response types will be fully typed once ProducesResponseType annotations are
 * added to all controller actions. Until then, response shapes are asserted
 * from the known API contract.
 *
 * To regenerate: npx openapi-typescript ../../platform/resolver/swagger.json -o src/api/schema.d.ts
 */
export const client = createClient<paths>({
  baseUrl: '',
})

// Inject auth token into every request (with proactive refresh)
client.use({
  async onRequest({ request }) {
    // Attempt to get a fresh token (refreshes proactively if near expiry)
    const token = await ensureFreshToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
  async onResponse({ response }) {
    // If we still get a 401, try one more refresh attempt
    if (response.status === 401) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        // Refresh failed — session is truly over
        clearTokens()
        window.location.href = '/login'
      }
      // If refresh succeeded, the next request from react-query retry will use the new token
    }
    return response
  },
})

// --- Typed response wrappers ---
// These provide the response shapes until the API has full ProducesResponseType annotations.
// They match the actual JSON output of the controller actions.

export interface UserSummary {
  displayName: string
  email: string
  pendingCount: number
  activeApps: number
  activeDevices: number
}

export interface DeviceInfo {
  id: string
  name: string
  deviceType: string
  isActive: boolean
  registeredAt: string
  lastSeenAt: string | null
  hasKey: boolean
}

export interface CreateDeviceResponse {
  id: string
  name: string
  deviceToken: string
}

export interface HistoryEntry {
  id: string
  requestId: string
  appId: string
  appName: string
  actionSummary: string
  type: string
  category: string | null
  status: string
  resolutionMethod: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface RegisteredApp {
  id: string
  appId: string
  appName: string
  appIcon: string | null
  registeredAt: string
  revokedAt: string | null
  isActive: boolean
}

// --- API functions (typed wrappers) ---

export const api = {
  getUserSummary: async () => {
    const { data, error } = await client.GET('/api/users/me/summary')
    if (error) throw new Error(String(error))
    return data as unknown as UserSummary
  },

  createUser: async () => {
    const { data, error } = await client.POST('/api/users/me')
    if (error) throw new Error(String(error))
    return data
  },

  getHistory: async (page = 1, pageSize = 20) => {
    const { data, error } = await client.GET('/api/history', {
      params: { query: { page, pageSize } },
    })
    if (error) throw new Error(String(error))
    return data as unknown as PagedResult<HistoryEntry>
  },

  getHistoryDetail: async (id: string) => {
    const { data, error } = await client.GET('/api/history/{id}', {
      params: { path: { id } },
    })
    if (error) throw new Error(String(error))
    return data as unknown as HistoryEntry
  },

  getDevices: async () => {
    const { data, error } = await client.GET('/api/devices')
    if (error) throw new Error(String(error))
    return data as unknown as DeviceInfo[]
  },

  createDevice: async (name: string, deviceType: string) => {
    const { data, error } = await client.POST('/api/devices', {
      body: { name, deviceType },
    })
    if (error) throw new Error(String(error))
    return data as unknown as CreateDeviceResponse
  },

  deleteDevice: async (id: string) => {
    const { error } = await client.DELETE('/api/devices/{id}', {
      params: { path: { id } },
    })
    if (error) throw new Error(String(error))
  },

  getRegisteredApps: async () => {
    const { data, error } = await client.GET('/api/registrations/apps')
    if (error) throw new Error(String(error))
    return data as unknown as RegisteredApp[]
  },

  revokeApp: async (id: string) => {
    const { error } = await client.DELETE('/api/registrations/apps/{id}', {
      params: { path: { id } },
    })
    if (error) throw new Error(String(error))
  },
}
