import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8')
}

test('MakefileContract_DevOutput_ListsInsuranceClaimsAndCliUsage', async () => {
  const makefile = await read('Makefile')

  assert.match(makefile, /Insurance Claims:\s+http:\/\/localhost:5020/)
  assert.match(makefile, /CLI attester:/)
  assert.match(makefile, /make cli/)
})

test('MakefileContract_HasInsuranceLogTarget', async () => {
  const makefile = await read('Makefile')

  assert.match(makefile, /^dev-logs-insurance:/m)
  assert.match(makefile, /docker compose logs -f --tail=50 insurance-claims/)
})

test('MakefileContract_UnitGateIncludesCli', async () => {
  const makefile = await read('Makefile')

  assert.match(makefile, /^test-unit-cli:.*##/m)
  assert.match(makefile, /^test-unit:.*\n(?:\t.*\n)*\t\$\(MAKE\) test-unit-cli$/m)
})

test('MakefileContract_BuildGateIncludesCli', async () => {
  const makefile = await read('Makefile')

  assert.match(makefile, /^build-cli:.*##/m)
  assert.match(makefile, /^build:.*build-cli.*##/m)
})

test('MakefileContract_IntegrationGateTargetsIntegrationProjectInRelease', async () => {
  const makefile = await read('Makefile')

  assert.match(
    makefile,
    /^test-integration:.*\n\tdotnet build platform\/resolver\/tests\/OHPP\.Tests\.Integration\.Api\/OHPP\.Tests\.Integration\.Api\.csproj --configuration Release --maxcpucount:1\n\tdotnet test platform\/resolver\/tests\/OHPP\.Tests\.Integration\.Api\/OHPP\.Tests\.Integration\.Api\.csproj --configuration Release --no-build --filter "Category=RequiresDocker" --logger "console;verbosity=detailed"$/m,
  )
})

for (const composeFile of ['docker-compose.yml', 'docker-compose.test.yml']) {
  test(`ComposeContract_${composeFile}_HasOneDatabaseContainerAndNoWorldInitService`, async () => {
    const compose = await read(composeFile)

    assert.doesNotMatch(compose, /^\s{2}world-database-init:/m)
    assert.equal((compose.match(/^\s{2}postgres:/gm) ?? []).length, 1)
    // No service may wait on a world-database-init one-shot. (Other legitimate
    // one-shots - cert-init, glitchtip-init - do use service_completed_successfully,
    // so the guard is scoped to the world-database-init dependency specifically.)
    assert.doesNotMatch(compose, /world-database-init:\s*\n\s*condition:\s*service_completed_successfully/)
  })
}

test('ComposeContract_DevelopmentEnablesProtocolLab', async () => {
  const compose = await read('docker-compose.yml')

  assert.match(compose, /Features__ProtocolLab:\s*"true"/)
  assert.match(compose, /VITE_ENABLE_PROTOCOL_LAB:\s*"true"/)
})

test('ComposeContract_TestEnvironmentEnablesProtocolLab', async () => {
  const compose = await read('docker-compose.test.yml')

  assert.match(compose, /Features__ProtocolLab:\s*"true"/)
  assert.match(compose, /VITE_ENABLE_PROTOCOL_LAB:\s*"true"/)
})

test('PortalContract_ProtocolLabRouteAndNavigationAreFlagGated', async () => {
  const router = await read('platform/portal/src/router.tsx')
  const dockerfile = await read('platform/portal/Dockerfile')

  assert.match(router, /import\.meta\.env\.VITE_ENABLE_PROTOCOL_LAB\s*===\s*'true'/)
  assert.match(router, /protocolLabEnabled\s*\?\s*\[/)
  assert.match(dockerfile, /ARG VITE_ENABLE_PROTOCOL_LAB=false/)
})
