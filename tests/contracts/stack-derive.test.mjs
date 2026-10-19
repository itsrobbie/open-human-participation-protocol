import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const helper = new URL('scripts/stack-derive.sh', root).pathname

// Run the helper with a given STACK_ID and parse its KEY=value output into a map.
function derive(stackId) {
  const env = { ...process.env }
  if (stackId === undefined) delete env.STACK_ID
  else env.STACK_ID = String(stackId)
  const out = execFileSync('sh', [helper], { env, encoding: 'utf8' })
  const map = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) map[m[1]] = m[2]
  }
  return map
}

test('StackDerive_StackZero_IsIdentityToTodaysDevValues', () => {
  const s0 = derive(0)
  // Ports equal today's committed dev ports.
  assert.equal(s0.OHPP_PORT_PORTAL, '3000')
  assert.equal(s0.OHPP_PORT_RESOLVER_HTTP, '5050')
  assert.equal(s0.OHPP_PORT_KEYCLOAK, '8080')
  assert.equal(s0.OHPP_PORT_BANK, '5010')
  assert.equal(s0.OHPP_PORT_POSTGRES, '5432')
  // Identity names.
  assert.equal(s0.OHPP_PROJECT, 'ohpp-0')
  assert.equal(s0.OHPP_DB_NAME, 'ohpp_0')
  assert.equal(s0.OHPP_REALM, 'ohpp-0')
  assert.equal(s0.OHPP_OTEL_INSTANCE_ID, '0')
})

test('StackDerive_UnsetStackId_DefaultsToZeroIdentity', () => {
  const dflt = derive(undefined)
  assert.equal(dflt.STACK_ID, '0')
  assert.equal(dflt.OHPP_PORT_PORTAL, '3000')
  assert.equal(dflt.OHPP_PROJECT, 'ohpp-0')
})

test('StackDerive_StackOne_IsBandedAndNonOverlappingWithStackZero', () => {
  const s0 = derive(0)
  const s1 = derive(1)
  const portKeys = Object.keys(s0).filter((k) => k.startsWith('OHPP_PORT_'))
  assert.ok(portKeys.length >= 20, 'expected the full port set')
  // Stack 1 uses the banded high range (20000..20374) and never reuses a
  // stack-0 (today's) port.
  const s0Ports = new Set(portKeys.map((k) => s0[k]))
  for (const k of portKeys) {
    const v = Number(s1[k])
    assert.ok(v >= 20000 && v <= 20374, `${k} stack-1 value ${v} should be in the banded range 20000..20374`)
    assert.ok(!s0Ports.has(s1[k]), `${k} stack-1 value ${s1[k]} must not collide with any stack-0 port`)
  }
  assert.equal(s1.OHPP_PROJECT, 'ohpp-1')
  assert.equal(s1.OHPP_DB_NAME, 'ohpp_1')
  assert.equal(s1.OHPP_REALM, 'ohpp-1')
  assert.equal(s1.OHPP_OTEL_INSTANCE_ID, '1')
})

test('StackDerive_AllStacksInRange_HaveNoPortCollisions', () => {
  // The 100% proof the model requires: across EVERY service and EVERY stack id
  // in [0, 16), no two (service, id) pairs ever share a host port, AND stack 0
  // reproduces today's exact ports. Static, exhaustive, memory-free.
  const MAX = 16
  const s0 = derive(0)
  const portKeys = Object.keys(s0).filter((k) => k.startsWith('OHPP_PORT_'))
  const seen = new Map() // port -> "SERVICE@id"
  for (let id = 0; id < MAX; id++) {
    const s = derive(id)
    for (const k of portKeys) {
      const port = s[k]
      const owner = `${k}@${id}`
      assert.ok(
        !seen.has(port),
        `port ${port} collides: ${owner} vs ${seen.get(port)}`,
      )
      seen.set(port, owner)
    }
  }
  // Stack 0 identity re-asserted inside the exhaustive sweep.
  assert.equal(s0.OHPP_PORT_PORTAL, '3000')
  assert.equal(s0.OHPP_PORT_PROMETHEUS, '9090')
})

test('StackDerive_StackIdAtOrAboveCeiling_IsRejected', () => {
  assert.throws(
    () => execFileSync('sh', [helper], { env: { ...process.env, STACK_ID: '16' }, encoding: 'utf8' }),
    /must be < 16/,
  )
})

test('StackDerive_NonIntegerStackId_IsRejected', () => {
  assert.throws(
    () => execFileSync('sh', [helper], { env: { ...process.env, STACK_ID: 'abc' }, encoding: 'utf8' }),
    /non-negative integer/,
  )
})
