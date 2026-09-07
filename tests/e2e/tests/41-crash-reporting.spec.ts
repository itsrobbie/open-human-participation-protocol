import { test, expect } from '@playwright/test'
import { RESOLVER_URL } from '../test-urls'
import { waitForErrorSpan } from '../utils/telemetry'

/**
 * U7.1 Phase 4 live verification: a backend crash surfaces as an OpenTelemetry
 * ERROR span in the Grafana stack (Tempo). Per the hybrid decision, backend
 * services report crashes via OTel error spans/logs (not a separate SDK); the
 * Flutter app path to GlitchTip is exercised in Phase 5.
 *
 * The resolver exposes a dev/test-only `/api/diagnostics/throw` (gated behind the
 * ProtocolLab feature flag) that raises an unhandled exception. The
 * GlobalExceptionHandler records it on the active span (status=error, exception
 * attributes) and returns a clean 500, so the crash is observable without
 * crashing the service.
 */
test.describe('Backend crash reporting (U7.1)', () => {
  test('an unhandled backend exception surfaces as an OTel error span in Tempo', async ({
    request,
  }) => {
    test.setTimeout(60_000)

    // Trigger the deliberate backend error. It returns 500 (handled cleanly).
    const res = await request.get(`${RESOLVER_URL}/api/diagnostics/throw`)
    expect(res.status(), 'the diagnostics endpoint should return a handled 500').toBe(500)

    // The crash should appear as an error-status span for ohpp.resolver in Tempo.
    const found = await waitForErrorSpan(request, 'ohpp.resolver')
    expect(
      found,
      'an ohpp.resolver span with status=error should appear in Tempo after the backend exception',
    ).toBe(true)
  })
})
