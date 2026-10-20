/**
 * Test stack URLs, derived from the worktree's STACK_ID (U9).
 *
 * The test stack is NOT a separate compose file any more; it is this worktree's
 * own tenant (its allocated STACK_ID) against the shared backing tier. The
 * Makefile materializes every derived host port into .stack.env and exports it,
 * so the Playwright subprocess sees OHPP_PORT_* in process.env. Stack 0 is
 * identity (today's ports); ids 1..15 use the banded range (20000..20374).
 *
 * Falling back to the stack-0 defaults keeps a bare `npx playwright test` (run
 * outside the Makefile, no env) pointed at the identity stack.
 */
function port(name: string, fallback: number): number {
  const v = process.env[`OHPP_PORT_${name}`]
  const n = v ? Number.parseInt(v, 10) : NaN
  return Number.isFinite(n) ? n : fallback
}

const host = (p: number) => `http://localhost:${p}`

export const PORTAL_URL = host(port('PORTAL', 3000))
export const RESOLVER_URL = host(port('RESOLVER_HTTP', 5050))
export const BANK_URL = host(port('BANK', 5010))
export const INSURANCE_URL = host(port('INSURANCE', 5020))
export const PIZZA_URL = host(port('PIZZA', 5030))
export const MARKETPLACE_URL = host(port('MARKETPLACE', 5040))
export const KEYCLOAK_URL = host(port('KEYCLOAK', 8080))

/** Tempo query API (shared backing; STACK_ID-invariant). */
export const TEMPO_URL = host(port('TEMPO', 3200))
/** OTel Collector OTLP/HTTP ingest (shared backing; browser span export target). */
export const OTEL_COLLECTOR_HTTP = host(port('OTLP_HTTP', 4318))
