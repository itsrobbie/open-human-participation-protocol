import { execSync } from 'child_process'
import { resolve } from 'path'

const COMPOSE_FILE = resolve(__dirname, '../../docker-compose.test.yml')
const PROJECT_NAME = 'ohpp-test'
const COMPOSE_CMD = `docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE}`
const COMPOSE = `${COMPOSE_CMD} --profile backing --profile apps`
const APP_SERVICES = 'resolver portal bank insurance-claims pizza marketplace'

/**
 * Global teardown: stops ONLY the apps tier by default, leaving the backing
 * tier (postgres, keycloak, otel-collector, tempo) running so the next run
 * starts fast. The dev stack (docker-compose.yml) is never touched.
 *
 * Set TEARDOWN_FULL=1 (e.g. in CI) to remove the entire stack + volumes.
 */
export default async function globalTeardown() {
  const full = process.env.TEARDOWN_FULL === '1'
  if (full) {
    console.log('Tearing down ENTIRE test stack (TEARDOWN_FULL=1)...')
    try {
      execSync(`${COMPOSE} --profile tools down --volumes --remove-orphans`, {
        cwd: __dirname,
        stdio: 'pipe',
        timeout: 60_000,
      })
      console.log('Test stack removed.')
    } catch {
      console.warn('Warning: full test stack teardown failed (may already be down)')
    }
    return
  }

  console.log('Stopping apps tier (backing tier left running for fast re-runs)...')
  try {
    execSync(`${COMPOSE} stop ${APP_SERVICES}`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 60_000,
    })
    console.log('Apps tier stopped. Backing tier still up (run TEARDOWN_FULL=1 or `make test-stack-down` to remove everything).')
  } catch {
    console.warn('Warning: apps tier teardown failed (may already be stopped)')
  }
}
