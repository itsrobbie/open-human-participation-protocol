/**
 * Token management for OHPP Portal.
 *
 * Handles access + refresh token lifecycle:
 * - Stores both tokens in localStorage
 * - Decodes JWT to check expiry
 * - Proactively refreshes before access token expires
 * - Falls back to login only when refresh token is also expired
 */

const KEYCLOAK_TOKEN_URL = '/auth/realms/ohpp/protocol/openid-connect/token'
const ACCESS_TOKEN_KEY = 'ohpp_device_token'
const REFRESH_TOKEN_KEY = 'ohpp_refresh_token'

// Buffer in seconds — refresh when less than this much time remains
const REFRESH_BUFFER_SECONDS = 60

/** Minimal JWT payload we need */
interface JwtPayload {
  exp: number
  sub?: string
  preferred_username?: string
}

/** Decode a JWT payload without verifying signature (client-side only) */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/** Check if a token is expired or will expire within the buffer period */
function isTokenExpiring(token: string, bufferSeconds = 0): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  const nowSeconds = Math.floor(Date.now() / 1000)
  return payload.exp - nowSeconds <= bufferSeconds
}

/** Get the stored access token */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Get the stored refresh token */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** Store tokens after login or refresh */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/** Clear all tokens (logout) */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/** Check if the user has a valid (non-expired) session */
export function hasValidSession(): boolean {
  const accessToken = getAccessToken()
  if (!accessToken) return false

  // If access token is still valid, session is good
  if (!isTokenExpiring(accessToken, 0)) return true

  // If access token is expired but refresh token exists and isn't expired, session can be restored
  const refreshToken = getRefreshToken()
  if (refreshToken && !isTokenExpiring(refreshToken, 0)) return true

  return false
}

// Prevent concurrent refresh requests
let refreshPromise: Promise<boolean> | null = null

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if refresh succeeded, false if user needs to re-login.
 * Deduplicates concurrent calls.
 */
export async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise

  refreshPromise = doRefresh()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  // If refresh token itself is expired, no point trying
  if (isTokenExpiring(refreshToken, 0)) {
    clearTokens()
    return false
  }

  try {
    const res = await fetch(KEYCLOAK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'ohpp-portal',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      clearTokens()
      return false
    }

    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    // Network error — don't clear tokens, might be temporary
    return false
  }
}

/**
 * Ensure we have a fresh access token.
 * Refreshes proactively if the token is about to expire.
 * Returns the valid access token, or null if re-login is required.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const accessToken = getAccessToken()

  // No token at all
  if (!accessToken) return null

  // Token still has plenty of time
  if (!isTokenExpiring(accessToken, REFRESH_BUFFER_SECONDS)) {
    return accessToken
  }

  // Token is expiring soon — try to refresh
  const refreshed = await refreshAccessToken()
  if (refreshed) {
    return getAccessToken()
  }

  return null
}

/**
 * Start a background timer that refreshes the token proactively.
 * Call this after login. Returns a cleanup function to stop the timer.
 */
export function startTokenRefreshTimer(): () => void {
  const CHECK_INTERVAL_MS = 30_000 // Check every 30 seconds

  const intervalId = setInterval(async () => {
    const accessToken = getAccessToken()
    if (!accessToken) {
      clearInterval(intervalId)
      return
    }

    // If token is expiring within the buffer, refresh it
    if (isTokenExpiring(accessToken, REFRESH_BUFFER_SECONDS)) {
      const success = await refreshAccessToken()
      if (!success) {
        // Refresh failed — session is truly over
        clearTokens()
        window.location.href = '/login'
      }
    }
  }, CHECK_INTERVAL_MS)

  return () => clearInterval(intervalId)
}
