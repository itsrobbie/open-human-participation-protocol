import { execSync } from 'child_process'
import { resolve } from 'path'

// U9: teardown only THIS worktree's app tier (ohpp-$STACK_ID), leaving the
// shared backing tier (ohpp-backing) up for other tenants and fast re-runs.
const REPO_ROOT = resolve(__dirname, '../..')
const OHPP_PROJECT = process.env.OHPP_PROJECT ?? 'ohpp-0'
const COMPOSE = `docker compose -p ${OHPP_PROJECT} -f docker-compose.apps.yml --profile apps`
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
        cwd: REPO_ROOT,
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
      cwd: REPO_ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    })
    console.log('Apps tier stopped. Backing tier still up (run TEARDOWN_FULL=1 or `make test-stack-down` to remove everything).')
  } catch {
    console.warn('Warning: apps tier teardown failed (may already be stopped)')
  }
}
