import { execSync } from 'child_process'
import { resolve, join } from 'path'
import { writeFileSync } from 'fs'
import { request as playwrightRequest } from '@playwright/test'

// U9: the test stack is this worktree's own tenant (its allocated STACK_ID)
// against the shared backing tier - NOT a separate compose file. Orchestration
// delegates to the Makefile split-file targets (test-backing-up / test-apps-up),
// which resolve the project (ohpp-$STACK_ID), run tenant-db-init, and use
// docker-compose.backing.yml + docker-compose.apps.yml. The repo root is two
// levels up from tests/e2e.
const REPO_ROOT = resolve(__dirname, '../..')
const OHPP_PROJECT = process.env.OHPP_PROJECT ?? 'ohpp-0'
const BACKING = `docker compose --progress quiet -p ohpp-backing -f docker-compose.backing.yml --profile backing`
const APPS = `docker compose --progress quiet -p ${OHPP_PROJECT} -f docker-compose.apps.yml --profile apps`
const APP_SERVICES = 'resolver portal bank insurance-claims pizza marketplace'

// Host ports derive from the worktree's STACK_ID (exported by the Makefile into
// .stack.env). Stack 0 = identity; ids 1..15 banded. Fallback = stack-0 ports.
function port(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[`OHPP_PORT_${name}`] ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}
const P = {
  resolver: port('RESOLVER_HTTP', 5050),
  bank: port('BANK', 5010),
  insurance: port('INSURANCE', 5020),
  pizza: port('PIZZA', 5030),
  marketplace: port('MARKETPLACE', 5040),
  portal: port('PORTAL', 3000),
  keycloak: port('KEYCLOAK', 8080),
}
// This tenant's database on the shared backing Postgres (ohpp_$STACK_ID). The
// reset only ever touches THIS database, so a parallel worktree's data is safe.
const TENANT_DB = process.env.OHPP_DB_NAME ?? 'ohpp_0'

/**
 * Global setup: starts this worktree's tenant stack and resets ITS database.
 *
 * 1. Ensures the shared backing tier is up (ohpp-backing), then this tenant's
 *    app tier (ohpp-$STACK_ID) via the Makefile targets.
 * 2. Waits for all services on this tenant's derived ports.
 * 3. Truncates ONLY this tenant's database (reset-db.sql against ohpp_$STACK_ID).
 *
 * Shares services with dev but never shares data (per-tenant database). The dev
 * stack's data is never touched: a parallel worktree has its own ohpp_N.
 * Torn down by global-teardown.ts after all tests complete.
 */
export default async function globalSetup() {
  console.log(`Starting tenant test stack (${OHPP_PROJECT})...`)

  const run = (cmd: string, timeout: number) =>
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', timeout })

  // Shared backing tier + this tenant's db, then build + start the app tier.
  // The Makefile targets own the split-file wiring, the project name, the
  // Keycloak redirect regen, and tenant-db-init.
  console.log('Ensuring shared backing tier + this tenant db are up...')
  run('make test-backing-up', 300_000)
  run('make tenant-db-init', 120_000)

  console.log('Building + starting this tenant app tier...')
  run(`${APPS} up --build -d --wait ${APP_SERVICES}`, 900_000)

  console.log('Waiting for services...')
  waitForService(`http://localhost:${P.resolver}/health`, 30)
  waitForService(`http://localhost:${P.bank}/health`, 15)
  waitForService(`http://localhost:${P.insurance}/health`, 15)
  waitForService(`http://localhost:${P.pizza}/health`, 30)
  waitForService(`http://localhost:${P.marketplace}/health`, 30)
  waitForService(`http://localhost:${P.portal}/api/health`, 20)

  await seedBankBrowserSession()

  console.log('Resetting this tenant database...')
  resetDatabase()
  verifySchemaIsolation()

  // Restart resolver + apps so all services reopen clean database connections after the reset.
  execSync(`${APPS} restart resolver bank insurance-claims pizza marketplace`, {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    timeout: 60_000,
  })

  waitForService(`http://localhost:${P.resolver}/health`, 30)
  waitForService(`http://localhost:${P.bank}/health`, 15)
  waitForService(`http://localhost:${P.insurance}/health`, 15)
  waitForService(`http://localhost:${P.pizza}/health`, 15)
  waitForService(`http://localhost:${P.marketplace}/health`, 15)

  // Reload portal nginx to reconnect to restarted resolver
  execSync(`${APPS} exec -T portal nginx -s reload`, {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  })
  waitForService(`http://localhost:${P.portal}/api/health`, 20)

  console.log('Test stack ready.')
}

async function seedBankBrowserSession() {
  const api = await playwrightRequest.newContext()
  const tokenResponse = await api.post(`http://localhost:${P.keycloak}/realms/ohpp-bank/protocol/openid-connect/token`, {
    form: { grant_type: 'password', client_id: 'ohpp-bank-app', username: 'demo', password: 'demo' },
  })
  if (!tokenResponse.ok()) throw new Error(`Unable to seed Bank browser session: ${tokenResponse.status()}`)
  const { access_token: accessToken } = await tokenResponse.json()
  writeFileSync(join(__dirname, '.auth-state.json'), JSON.stringify({
    cookies: [],
    origins: [{ origin: `http://localhost:${P.bank}`, localStorage: [{ name: 'ohpp-bank-access-token', value: accessToken }] }],
  }))
  await api.dispose()
}

function resetDatabase() {
  const sqlFile = resolve(__dirname, 'reset-db.sql')
  execSync(
    `${BACKING} exec -T postgres psql -U ohpp -d ${TENANT_DB} -f /dev/stdin < "${sqlFile}"`,
    // bash (not zsh): present on both macOS and the Linux CI runner. zsh is
    // macOS-only — a hardcoded /bin/zsh here failed CI with spawnSync ENOENT.
    { cwd: REPO_ROOT, stdio: 'pipe', shell: '/bin/bash' }
  )
}

function verifySchemaIsolation() {
  runRoleQuery('bank_app', 'ohpp_bank_demo_password', 'select 1 from bank.accounts limit 1')
  runRoleQuery('insurance_claims_app', 'ohpp_insurance_demo_password', 'select 1 from insurance_claims.claims limit 1')
  expectRoleQueryDenied('bank_app', 'ohpp_bank_demo_password', 'select 1 from insurance_claims.claims limit 1')
  expectRoleQueryDenied('insurance_claims_app', 'ohpp_insurance_demo_password', 'select 1 from bank.accounts limit 1')
}

function runRoleQuery(role: string, password: string, sql: string) {
  execSync(
    `${BACKING} exec -T -e PGPASSWORD=${password} postgres psql -h 127.0.0.1 -U ${role} -d ${TENANT_DB} -v ON_ERROR_STOP=1 -c "${sql}"`,
    { cwd: REPO_ROOT, stdio: 'pipe' }
  )
}

function expectRoleQueryDenied(role: string, password: string, sql: string) {
  let denied = false
  try {
    runRoleQuery(role, password, sql)
  } catch {
    denied = true
  }
  if (!denied) throw new Error(`${role} unexpectedly accessed another application's schema`)
}

function waitForService(url: string, maxAttempts: number) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`curl -sf ${url}`, { stdio: 'pipe' })
      return
    } catch {
      execSync('sleep 1')
    }
  }
  throw new Error(`Service ${url} not ready after ${maxAttempts}s`)
}
