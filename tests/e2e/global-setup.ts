import { execSync } from 'child_process'
import { resolve } from 'path'

const COMPOSE_FILE = resolve(__dirname, '../../docker-compose.test.yml')
const PROJECT_NAME = 'ohpp-test'
const COMPOSE_CMD = `docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE}`

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

  // Start the test stack. Use --build only if images don't exist yet.
  // --wait blocks until all healthchecks pass.
  try {
    execSync(`${COMPOSE_CMD} up -d --wait`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 120_000,
    })
  } catch {
    // If up fails (images don't exist), try with --build
    console.log('Building test stack images...')
    execSync(`${COMPOSE_CMD} up --build -d --wait`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 300_000,
    })
  }

  console.log('Waiting for services...')
  waitForService('http://localhost:5150/health', 30)
  waitForService('http://localhost:5110/health', 15)
  waitForService('http://localhost:3100/api/health', 20)

  console.log('Resetting database...')
  resetDatabase()

  // Restart resolver + bank for clean in-memory state after DB wipe
  execSync(`${COMPOSE_CMD} restart resolver bank`, {
    cwd: __dirname,
    stdio: 'pipe',
    timeout: 60_000,
  })

  waitForService('http://localhost:5150/health', 30)
  waitForService('http://localhost:5110/health', 15)

  // Reload portal nginx to reconnect to restarted resolver
  execSync(`${COMPOSE_CMD} exec -T portal nginx -s reload`, {
    cwd: __dirname,
    stdio: 'pipe',
  })
  waitForService('http://localhost:3100/api/health', 20)

  console.log('Test stack ready.')
}

function resetDatabase() {
  const sqlFile = resolve(__dirname, 'reset-db.sql')
  execSync(
    `${COMPOSE_CMD} exec -T postgres psql -U ohpp -d ohpp -f /dev/stdin < "${sqlFile}"`,
    { cwd: __dirname, stdio: 'pipe', shell: '/bin/zsh' }
  )
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
