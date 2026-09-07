import type { APIRequestContext, Page, Request } from '@playwright/test'
import { PORTAL_URL, TEMPO_URL } from '../test-urls'

/**
 * Reusable helpers for validating U7.1 observability from Playwright tests.
 * Keeping these here (rather than ad-hoc shell) means the checks are reviewable,
 * versioned, and run via `make`.
 */

export const COLLECTOR_TRACES_PATH = '/v1/traces'

/** Fetch the Portal's built JS bundle text (all module scripts concatenated). */
export async function fetchPortalBundle(request: APIRequestContext): Promise<string> {
  const indexHtml = await (await request.get(`${PORTAL_URL}/`)).text()
  // Match every JS asset referenced from index.html (script src or modulepreload).
  const assetPaths = [...indexHtml.matchAll(/(?:src|href)="(\/?assets\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  )
  if (assetPaths.length === 0) {
    throw new Error(`No JS asset scripts found in Portal index.html. HTML was:\n${indexHtml}`)
  }
  const chunks = await Promise.all(
    assetPaths.map(async (p) => (await request.get(`${PORTAL_URL}${p.startsWith('/') ? p : `/${p}`}`)).text()),
  )
  return chunks.join('\n')
}

/**
 * Records telemetry-relevant network activity on a page:
 *  - statuses of OTLP export POSTs the browser sends to the Collector
 *  - traceparent headers on outbound /api fetches to the Resolver
 * Call before navigation.
 */
export function captureTelemetryTraffic(page: Page): {
  otlpExportStatuses: number[]
  otlpExportAttempts: string[]
  otlpExportFailures: string[]
  apiTraceparents: Array<{ url: string; traceparent: string }>
  consoleErrors: string[]
} {
  const otlpExportStatuses: number[] = []
  const otlpExportAttempts: string[] = []
  const otlpExportFailures: string[] = []
  const apiTraceparents: Array<{ url: string; traceparent: string }> = []
  const consoleErrors: string[] = []

  page.on('request', (req: Request) => {
    const url = req.url()
    if (url.includes(COLLECTOR_TRACES_PATH)) otlpExportAttempts.push(`${req.method()} ${url}`)
    const tp = req.headers()['traceparent']
    if (tp && url.includes('/api/')) apiTraceparents.push({ url, traceparent: tp })
  })
  page.on('response', (res) => {
    if (res.url().includes(COLLECTOR_TRACES_PATH)) otlpExportStatuses.push(res.status())
  })
  page.on('requestfailed', (req: Request) => {
    const url = req.url()
    if (url.includes(COLLECTOR_TRACES_PATH)) {
      otlpExportFailures.push(`${url} -> ${req.failure()?.errorText ?? 'unknown'}`)
    }
  })
  page.on('console', (msg) => {
    if (
      process.env.TELEMETRY_DEBUG === '1' ||
      msg.type() === 'error' ||
      /telemetry|otel|opentelemetry|cors|span/i.test(msg.text())
    ) {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`)
    }
  })

  return { otlpExportStatuses, otlpExportAttempts, otlpExportFailures, apiTraceparents, consoleErrors }
}

/**
 * Poll Tempo's search API until a trace matching the tag query appears.
 *
 * Includes an explicit recent time window: Tempo's tag search otherwise misses
 * sparsely-emitting services (verified against the dev stack), so an unbounded
 * search can return 0 even when the trace exists. Optionally target a specific
 * Tempo base URL (defaults to the test-stack TEMPO_URL).
 */
export async function waitForTempoTrace(
  request: APIRequestContext,
  tagQuery: string,
  timeoutMs = 30_000,
  tempoUrl: string = TEMPO_URL,
  lookbackSeconds = 3600,
): Promise<Array<{ traceID: string; rootServiceName?: string; rootTraceName?: string }>> {
  const deadline = Date.now() + timeoutMs
  let last: Array<{ traceID: string; rootServiceName?: string; rootTraceName?: string }> = []
  while (Date.now() < deadline) {
    const end = Math.floor(Date.now() / 1000)
    const start = end - lookbackSeconds
    const res = await request.get(
      `${tempoUrl}/api/search?tags=${encodeURIComponent(tagQuery)}&limit=20&start=${start}&end=${end}`,
    )
    if (res.ok()) {
      const body = await res.json()
      last = body.traces ?? []
      if (last.length > 0) return last
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return last
}

/** Return the distinct service.name values present in a Tempo trace by id. */
export async function servicesInTrace(
  request: APIRequestContext,
  traceId: string,
  timeoutMs = 30_000,
  tempoUrl: string = TEMPO_URL,
): Promise<Set<string>> {
  const deadline = Date.now() + timeoutMs
  let services = new Set<string>()
  while (Date.now() < deadline) {
    const res = await request.get(`${tempoUrl}/api/traces/${traceId}`)
    if (res.ok()) {
      const body = await res.json()
      services = new Set<string>()
      for (const b of body.batches ?? []) {
        for (const a of b.resource?.attributes ?? []) {
          if (a.key === 'service.name') services.add(a.value?.stringValue)
        }
      }
      if (services.size > 0) return services
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return services
}

/**
 * Poll Tempo for a trace on the given service that contains an ERROR-status span,
 * returning true once found. Uses TraceQL ({ status = error }) via the search API.
 */
export async function waitForErrorSpan(
  request: APIRequestContext,
  serviceName: string,
  timeoutMs = 40_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const query = `{ resource.service.name = "${serviceName}" && status = error }`
  while (Date.now() < deadline) {
    const res = await request.get(
      `${TEMPO_URL}/api/search?q=${encodeURIComponent(query)}&limit=5`,
    )
    if (res.ok()) {
      const body = await res.json()
      if ((body.traces ?? []).length > 0) return true
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

/** Log into the Portal and land on the dashboard (triggers /api fetches). */
export async function loginToPortal(page: Page): Promise<void> {
  await page.goto(`${PORTAL_URL}/login`)
  await page.fill('input[placeholder="demo"]', 'demo')
  await page.fill('input[type="password"]', 'demo')
  await page.click('button[type="submit"]')
  await page.waitForURL(PORTAL_URL + '/', { timeout: 20_000 })
}
