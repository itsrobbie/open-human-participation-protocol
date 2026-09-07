import { test, expect } from '@playwright/test'
import {
  fetchPortalBundle,
  captureTelemetryTraffic,
  waitForTempoTrace,
  servicesInTrace,
  loginToPortal,
} from '../utils/telemetry'

/**
 * U7.1 final validation: the Portal's BROWSER OpenTelemetry actually works
 * end-to-end. A build/bundle check alone is not enough - a browser SPA only
 * emits telemetry when a real browser runs it - so this drives the Portal
 * headlessly and queries the live Tempo backend to prove spans arrived.
 *
 * Requires the observability backbone (otel-collector + tempo) in the test
 * stack, and the Portal built with VITE_OTEL_EXPORTER_OTLP_ENDPOINT
 * (docker-compose.test.yml provides both).
 */
test.describe('Portal — browser telemetry (U7.1)', () => {
  // Fast structural check: the Vite build must bake the OTLP endpoint + service
  // name into the shipped bundle. If this fails, the image was built without the
  // VITE_OTEL_* build args (e.g. stale cached image) and no spans can be emitted.
  test('bundle is built with the OTLP endpoint baked in', async ({ request }) => {
    const bundle = await fetchPortalBundle(request)
    expect(bundle, 'bundle should contain the OTLP /v1/traces path').toContain('/v1/traces')
    expect(bundle, 'bundle should contain the ohpp.portal service name').toContain('ohpp.portal')
  })

  test('emits spans to Tempo as ohpp.portal and propagates trace context to the Resolver', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000)

    const {
      otlpExportStatuses,
      otlpExportAttempts,
      otlpExportFailures,
      apiTraceparents,
      consoleErrors,
    } = captureTelemetryTraffic(page)

    // Drive the Portal: login (Keycloak) then dashboard (/api fetches to the
    // Resolver). Reload once to guarantee authenticated /api calls fire while
    // instrumentation is active.
    await loginToPortal(page)
    await page.reload({ waitUntil: 'networkidle' })

    // Allow the BatchSpanProcessor to flush to the Collector. Then navigate away
    // to trigger the browser's pagehide/visibilitychange flush so the client-side
    // fetch spans (which join the Resolver's trace) are exported before we query.
    await page.waitForTimeout(6000)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await page.goto('about:blank')
    await page.waitForTimeout(3000)

    const diag = `attempts=${JSON.stringify(otlpExportAttempts)} failures=${JSON.stringify(otlpExportFailures)} console=${JSON.stringify(consoleErrors.slice(0, 15))}`

    // 1. Browser exported spans successfully (2xx).
    expect(
      otlpExportStatuses.length,
      `browser should POST spans to the Collector. ${diag}`,
    ).toBeGreaterThan(0)
    expect(
      otlpExportStatuses.every((s) => s >= 200 && s < 300),
      `all OTLP exports should be 2xx, saw ${JSON.stringify(otlpExportStatuses)}`,
    ).toBe(true)

    // 2. The span is queryable in Tempo as ohpp.portal.
    const portalTraces = await waitForTempoTrace(request, 'service.name=ohpp.portal')
    expect(portalTraces.length, 'ohpp.portal traces should appear in Tempo').toBeGreaterThan(0)

    // 3. Trace-context propagation: the Portal's /api fetch carried a traceparent.
    expect(
      apiTraceparents.length,
      'the Portal /api fetch to the Resolver should carry a W3C traceparent header',
    ).toBeGreaterThan(0)

    // ...and there should be a single trace containing BOTH the Portal (client)
    // and Resolver (server) spans. Every /api call the Portal made carries a
    // traceparent; check each candidate trace (client + server spans flush
    // independently, so poll across all of them) until one shows both services.
    const candidateTraceIds = [
      ...new Set(apiTraceparents.map((t) => t.traceparent.split('-')[1])),
    ]
    let joinedTraceId: string | undefined
    const joinDeadline = Date.now() + 30_000
    while (Date.now() < joinDeadline && !joinedTraceId) {
      for (const id of candidateTraceIds) {
        const services = await servicesInTrace(request, id, 3_000)
        if (services.has('ohpp.portal') && services.has('ohpp.resolver')) {
          joinedTraceId = id
          break
        }
      }
      if (!joinedTraceId) await new Promise((r) => setTimeout(r, 2000))
    }
    expect(
      joinedTraceId,
      `one of the Portal /api traces (${JSON.stringify(candidateTraceIds)}) should contain both ohpp.portal and ohpp.resolver spans (joined cross-service trace)`,
    ).toBeTruthy()
  })
})
