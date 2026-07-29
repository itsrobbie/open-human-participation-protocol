import { execSync } from 'child_process'
import { resolve } from 'path'

const COMPOSE_FILE = resolve(__dirname, '../../docker-compose.test.yml')
const PROJECT_NAME = 'ohpp-test'
const COMPOSE_CMD = `docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE}`

/**
 * Global teardown: stops and removes the isolated test stack.
 * All containers, networks, and anonymous volumes are removed.
 * The dev stack (docker-compose.yml) is never touched.
 */
export default async function globalTeardown() {
  console.log('Tearing down test stack...')
  try {
    execSync(`${COMPOSE_CMD} down --volumes --remove-orphans`, {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 30_000,
    })
    console.log('Test stack removed.')
  } catch (e) {
    console.warn('Warning: test stack teardown failed (may already be down)')
  }
}
