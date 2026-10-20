/**
 * DEV-stack URLs for the whole-world observability sweep (U7.1 Phase 10).
 *
 * The app/platform URLs derive from this worktree's STACK_ID (U9): stack 0 =
 * today's ports, ids 1..15 banded. The observability query APIs are SHARED
 * backing (one instance, STACK_ID-invariant), so they stay on fixed host ports.
 * The sweep validates that data from every service lands in the one set of
 * dashboards.
 */

function port(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[`OHPP_PORT_${name}`] ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}
const host = (p: number) => `http://localhost:${p}`

// Apps / platform (derive from STACK_ID; stack 0 = today's dev ports)
export const DEV_PORTAL_URL = host(port('PORTAL', 3000))
export const DEV_RESOLVER_URL = host(port('RESOLVER_HTTP', 5050))
export const DEV_BANK_URL = host(port('BANK', 5010))
export const DEV_INSURANCE_URL = host(port('INSURANCE', 5020))
export const DEV_PIZZA_URL = host(port('PIZZA', 5030))
export const DEV_MARKETPLACE_URL = host(port('MARKETPLACE', 5040))
export const DEV_KEYCLOAK_URL = host(port('KEYCLOAK', 8080))

// Observability query APIs (SHARED backing, fixed host ports, STACK_ID-invariant)
export const DEV_LOKI_URL = 'http://localhost:3110' // Loki query API (LogQL)
export const DEV_TEMPO_URL = 'http://localhost:3200' // Tempo query API (search + traces)
export const DEV_PROMETHEUS_URL = 'http://localhost:9090' // Prometheus query API
export const DEV_GRAFANA_URL = 'http://localhost:3001' // single pane (UI)
export const DEV_GLITCHTIP_URL = 'http://localhost:8000' // crash reporting
export const DEV_UMAMI_URL = 'http://localhost:8001' // product analytics (opt-in)

/** OTel service names emitted by each backend/app (service.name / resource attr). */
export const OHPP_SERVICES = [
  'ohpp.resolver',
  'ohpp.portal',
  'ohpp.bank',
  'ohpp.insurance',
  'ohpp.pizza',
  'ohpp.marketplace',
] as const

/** The seeded Umami analytics website id (deterministic tracking key). */
export const UMAMI_WEBSITE_ID = '0a119000-0b11-4000-8000-000000000002'
