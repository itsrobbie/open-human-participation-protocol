import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureFreshToken,
  getAccessToken,
  getRefreshToken,
  hasValidSession,
  refreshAccessToken,
  setTokens,
} from './token'

function jwt(expiresAtSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expiresAtSeconds }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  return `header.${payload}.signature`
}

describe('Portal token lifecycle', () => {
  const now = new Date('2026-08-01T08:00:00Z')
  const nowSeconds = Math.floor(now.getTime() / 1000)

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.restoreAllMocks()
  })

  it('Token_HasValidSession_UsesLiveAccessToken', () => {
    setTokens(jwt(nowSeconds + 600), jwt(nowSeconds + 1800))
    expect(hasValidSession()).toBe(true)
  })

  it('Token_HasValidSession_UsesLiveRefreshTokenWhenAccessExpired', () => {
    setTokens(jwt(nowSeconds - 1), jwt(nowSeconds + 1800))
    expect(hasValidSession()).toBe(true)
  })

  it('Token_EnsureFreshToken_RefreshesExpiringAccessToken', async () => {
    setTokens(jwt(nowSeconds + 30), jwt(nowSeconds + 1800))
    const refreshedAccess = jwt(nowSeconds + 900)
    const refreshedRefresh = jwt(nowSeconds + 3600)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: refreshedAccess,
      refresh_token: refreshedRefresh,
    }), { status: 200 })))

    expect(await ensureFreshToken()).toBe(refreshedAccess)
    expect(getRefreshToken()).toBe(refreshedRefresh)
  })

  it('Token_RefreshAccessToken_DeduplicatesConcurrentRequests', async () => {
    setTokens(jwt(nowSeconds + 30), jwt(nowSeconds + 1800))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: jwt(nowSeconds + 900),
      refresh_token: jwt(nowSeconds + 3600),
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Token_RefreshAccessToken_NetworkFailurePreservesTokens', async () => {
    const access = jwt(nowSeconds + 30)
    const refresh = jwt(nowSeconds + 1800)
    setTokens(access, refresh)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await refreshAccessToken()).toBe(false)
    expect(getAccessToken()).toBe(access)
    expect(getRefreshToken()).toBe(refresh)
  })
})
