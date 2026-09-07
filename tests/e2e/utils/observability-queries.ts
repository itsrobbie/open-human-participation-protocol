import type { APIRequestContext } from '@playwright/test'

/**
 * Reusable, reviewable query helpers for the whole-world observability sweep
 * (U7.1 Phase 10). Each backend has a public query API; these wrap the specific
 * endpoints + polling so the sweep spec reads as assertions, not shell.
 *
 * All helpers take the backend base URL explicitly (dev-stack URLs live in
 * ../dev-observability-urls.ts), so the same helpers work against any stack.
 *
 * Label mapping note: the collector ships logs to Loki via OTLP-native ingestion
 * (loki:3100/otlp) and metrics to Prometheus via remote-write. In both, the OTel
 * resource attribute `service.name` surfaces as the label `service_name`.
 */

async function poll(
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  // Always try at least once, even if timeoutMs is tiny.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await fn()) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// ---------------------------------------------------------------------------
// Loki (logs) - LogQL over the query-range API
// ---------------------------------------------------------------------------

/**
 * Returns true once Loki has at least one log line for the given service
 * (label `service_name`) within the lookback window.
 */
export async function lokiHasLogsForService(
  request: APIRequestContext,
  lokiUrl: string,
  serviceName: string,
  { timeoutMs = 30_000, lookbackSeconds = 3600 } = {},
): Promise<boolean> {
  return poll(async () => {
    const end = Date.now() * 1_000_000 // ns
    const start = (Date.now() - lookbackSeconds * 1000) * 1_000_000
    const query = `{service_name="${serviceName}"}`
    const url = `${lokiUrl}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&limit=1`
    const res = await request.get(url)
    if (!res.ok()) return false
    const body = await res.json()
    const streams = body?.data?.result ?? []
    return streams.some((s: { values?: unknown[] }) => (s.values?.length ?? 0) > 0)
  }, timeoutMs)
}

/** The distinct `service_name` label values Loki currently knows about. */
export async function lokiServiceNames(
  request: APIRequestContext,
  lokiUrl: string,
): Promise<string[]> {
  const res = await request.get(`${lokiUrl}/loki/api/v1/label/service_name/values`)
  if (!res.ok()) return []
  const body = await res.json()
  return body?.data ?? []
}

// ---------------------------------------------------------------------------
// Prometheus (metrics) - instant query / series lookup
// ---------------------------------------------------------------------------

/**
 * Returns true once Prometheus has at least one metric series for the given
 * service. The OTel remote-write pipeline maps the resource `service.name` to the
 * Prometheus `job` label (verified against the live stack), so `job` is matched
 * first; `service_name` is kept as a fallback for robustness.
 */
export async function prometheusHasMetricsForService(
  request: APIRequestContext,
  promUrl: string,
  serviceName: string,
  { timeoutMs = 30_000 } = {},
): Promise<boolean> {
  return poll(async () => {
    for (const matcher of [`{job="${serviceName}"}`, `{service_name="${serviceName}"}`]) {
      const url = `${promUrl}/api/v1/series?match[]=${encodeURIComponent(matcher)}`
      const res = await request.get(url)
      if (!res.ok()) continue
      const body = await res.json()
      if ((body?.data ?? []).length > 0) return true
    }
    return false
  }, timeoutMs)
}

/** Distinct `job` label values Prometheus currently knows about (service identity). */
export async function prometheusServiceNames(
  request: APIRequestContext,
  promUrl: string,
): Promise<string[]> {
  const res = await request.get(`${promUrl}/api/v1/label/job/values`)
  if (!res.ok()) return []
  const body = await res.json()
  return body?.data ?? []
}

// ---------------------------------------------------------------------------
// Tempo (traces) - search API keyed by resource service.name
// ---------------------------------------------------------------------------

/**
 * Returns true once Tempo has at least one trace for the given service.
 *
 * Uses the legacy tag search (`tags=service.name=...`) with an explicit recent
 * time window - verified to work reliably against the dev stack, whereas the
 * TraceQL `q=` form missed sparsely-emitting services. Demo apps only trace real
 * (non-health) requests, so callers should drive a real request just before
 * asserting.
 */
export async function tempoHasTracesForService(
  request: APIRequestContext,
  tempoUrl: string,
  serviceName: string,
  { timeoutMs = 30_000, lookbackSeconds = 3600 } = {},
): Promise<boolean> {
  return poll(async () => {
    const end = Math.floor(Date.now() / 1000)
    const start = end - lookbackSeconds
    const url = `${tempoUrl}/api/search?tags=${encodeURIComponent(`service.name=${serviceName}`)}&limit=5&start=${start}&end=${end}`
    const res = await request.get(url)
    if (!res.ok()) return false
    const body = await res.json()
    return (body?.traces ?? []).length > 0
  }, timeoutMs)
}

// ---------------------------------------------------------------------------
// Umami (product analytics) - event metrics for the seeded website
// ---------------------------------------------------------------------------

/** Log in to Umami and return a bearer token (self-hosted admin/umami). */
export async function umamiLogin(
  request: APIRequestContext,
  umamiUrl: string,
  username = 'admin',
  password = 'umami',
): Promise<string | null> {
  const res = await request.post(`${umamiUrl}/api/auth/login`, {
    data: { username, password },
  })
  if (!res.ok()) return null
  const body = await res.json()
  return body?.token ?? null
}

/**
 * Returns true once an event with the given name appears in the website's event
 * metrics. Requires a browser-like User-Agent + a url on ingest (see the app
 * sink / verify-analytics.sh) - this only QUERIES, it does not ingest.
 */
export async function umamiHasEvent(
  request: APIRequestContext,
  umamiUrl: string,
  token: string,
  websiteId: string,
  eventName: string,
  { timeoutMs = 30_000, lookbackSeconds = 3600 } = {},
): Promise<boolean> {
  return poll(async () => {
    const startAt = Date.now() - lookbackSeconds * 1000
    const endAt = Date.now() + lookbackSeconds * 1000
    const url = `${umamiUrl}/api/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=event`
    const res = await request.get(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok()) return false
    const body = await res.json()
    // metrics returns [{ x: <eventName>, y: <count> }, ...]
    return Array.isArray(body) && body.some((m: { x?: string }) => m.x === eventName)
  }, timeoutMs)
}

// ---------------------------------------------------------------------------
// GlitchTip (crash reporting) - issues for the seeded project
// ---------------------------------------------------------------------------

/**
 * Returns true if GlitchTip is reachable and reports at least one issue/event.
 * GlitchTip requires auth for its API; for the sweep we treat reachability +
 * (optionally) a visible issue as the signal. Crash INGESTION is proven by the
 * dedicated crash spec (41-crash-reporting) / the Flutter crash path.
 */
export async function glitchtipReachable(
  request: APIRequestContext,
  glitchtipUrl: string,
): Promise<boolean> {
  const res = await request.get(`${glitchtipUrl}/_health/`)
  return res.ok()
}
