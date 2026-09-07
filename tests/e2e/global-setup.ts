import { execSync } from 'child_process'
import { resolve, join } from 'path'
import { writeFileSync } from 'fs'
import { request as playwrightRequest } from '@playwright/test'

const COMPOSE_FILE = resolve(__dirname, '../../docker-compose.test.yml')
const PROJECT_NAME = 'ohpp-test'
const COMPOSE_CMD = `docker compose --progress quiet -p ${PROJECT_NAME} -f ${COMPOSE_FILE}`
// Both profiles are activated on every invocation so apps' depends_on links to
// backing services resolve; lifecycle is controlled by naming services.
const COMPOSE = `${COMPOSE_CMD} --profile backing --profile apps`
const APP_SERVICES = 'resolver portal bank insurance-claims pizza marketplace'

/**
 * Global setup: starts an isolated test stack and resets state.
 *
 * 1. Starts the test Docker stack (separate project, separate ports)
 * 2. Waits for all services to be healthy
 * 3. Truncates DB tables for clean state
 *
 * The test stack uses different ports from the dev stack so they never conflict.
 * Torn down by global-teardown.ts after all tests complete.
 */
export default async function globalSetup() {
  console.log('Starting isolated test stack...')

  // Backing tier (postgres, keycloak, otel-collector, tempo) persists across
  // runs - start it if it isn't already up. It's rarely rebuilt, so this is a
  // fast no-op on repeat runs.
  console.log('Ensuring backing tier is up...')
  // Run the CA one-shot to completion first so leaf certs exist before apps
  // start (HTTPS hops depend on them). It's a one-shot (restart: no) so it must
  // not be part of the --wait set.
  execSync(`${COMPOSE_CMD} --profile backing up cert-init`, {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 300_000,
  })
  execSync(`${COMPOSE_CMD} --profile backing up -d --wait postgres keycloak otel-collector tempo`, {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 300_000,
  })

  // Always rebuild the apps tier so browser and server tests execute the
  // workspace state under test. --wait blocks until healthchecks pass. Backing
  // services already running are reused, not recreated.
  console.log('Building + starting apps tier...')
  execSync(`${COMPOSE} up --build -d --wait ${APP_SERVICES}`, {
    cwd: __dirname,
    // Stream build and health-check progress so a slow image or service is
    // diagnosable instead of appearing as a silent Playwright stall.
    stdio: 'inherit',
    timeout: 900_000,
  })

  console.log('Waiting for services...')
  waitForService('http://localhost:5150/health', 30)
  waitForService('http://localhost:5110/health', 15)
  waitForService('http://localhost:5120/health', 15)
  waitForService('http://localhost:5130/health', 30)
  waitForService('http://localhost:5140/health', 30)
  waitForService('http://localhost:3100/api/health', 20)

  await seedBankBrowserSession()

  console.log('Resetting database...')
  resetDatabase()
  verifySchemaIsolation()

  // Restart resolver + apps so all services reopen clean database connections after the reset.
  execSync(`${COMPOSE} restart resolver bank insurance-claims pizza marketplace`, {
    cwd: __dirname,
    stdio: 'pipe',
    timeout: 60_000,
  })

  waitForService('http://localhost:5150/health', 30)
  waitForService('http://localhost:5110/health', 15)
  waitForService('http://localhost:5120/health', 15)
  waitForService('http://localhost:5130/health', 15)
  waitForService('http://localhost:5140/health', 15)

  // Reload portal nginx to reconnect to restarted resolver
  execSync(`${COMPOSE_CMD} exec -T portal nginx -s reload`, {
    cwd: __dirname,
    stdio: 'pipe',
  })
  waitForService('http://localhost:3100/api/health', 20)

  console.log('Test stack ready.')
}

async function seedBankBrowserSession() {
  const api = await playwrightRequest.newContext()
  const tokenResponse = await api.post('http://localhost:8180/realms/ohpp-bank/protocol/openid-connect/token', {
    form: { grant_type: 'password', client_id: 'ohpp-bank-app', username: 'demo', password: 'demo' },
  })
  if (!tokenResponse.ok()) throw new Error(`Unable to seed Bank browser session: ${tokenResponse.status()}`)
  const { access_token: accessToken } = await tokenResponse.json()
  writeFileSync(join(__dirname, '.auth-state.json'), JSON.stringify({
    cookies: [],
    origins: [{ origin: 'http://localhost:5110', localStorage: [{ name: 'ohpp-bank-access-token', value: accessToken }] }],
  }))
  await api.dispose()
}

function resetDatabase() {
  const sqlFile = resolve(__dirname, 'reset-db.sql')
  execSync(
    `${COMPOSE_CMD} exec -T postgres psql -U ohpp -d ohpp -f /dev/stdin < "${sqlFile}"`,
    { cwd: __dirname, stdio: 'pipe', shell: '/bin/zsh' }
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
    `${COMPOSE_CMD} exec -T -e PGPASSWORD=${password} postgres psql -h 127.0.0.1 -U ${role} -d ohpp -v ON_ERROR_STOP=1 -c "${sql}"`,
    { cwd: __dirname, stdio: 'pipe' }
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
