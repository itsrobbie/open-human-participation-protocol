/**
 * DEV-stack URLs for the whole-world observability sweep (U7.1 Phase 10).
 *
 * Unlike test-urls.ts (the isolated `ohpp-test` stack), these point at the DEV
 * stack started by `make dev` + `make dev-analytics`, which is the only stack
 * that runs the FULL observability backbone (Loki + Tempo + Prometheus + Grafana
 * + GlitchTip + Umami) alongside every app and the Flutter client. The sweep
 * validates that data from every service lands in the one set of dashboards.
 */

// Apps / platform (dev ports)
export const DEV_PORTAL_URL = 'http://localhost:3000'
export const DEV_RESOLVER_URL = 'http://localhost:5050'
export const DEV_BANK_URL = 'http://localhost:5010'
export const DEV_INSURANCE_URL = 'http://localhost:5020'
export const DEV_PIZZA_URL = 'http://localhost:5030'
export const DEV_MARKETPLACE_URL = 'http://localhost:5040'
export const DEV_KEYCLOAK_URL = 'http://localhost:8080'

// Observability query APIs (dev host ports)
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
