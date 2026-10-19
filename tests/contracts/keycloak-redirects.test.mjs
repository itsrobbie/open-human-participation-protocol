import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const gen = new URL('scripts/gen-keycloak-redirects.py', root).pathname

// The committed Keycloak realm exports must stay in sync with the generator
// (single source of truth = scripts/stack-derive.sh). If a dev edits the ports
// or the banded scheme changes, `gen-keycloak-redirects.py --check` fails and so
// does this gate, forcing a regenerate. This is the U9 "additive, no hand-edit"
// guarantee for per-tenant redirect URIs.
test('Keycloak_RealmRedirects_MatchGenerator', () => {
  // --check exits 0 when every realm export already matches, non-zero otherwise.
  // execFileSync throws on non-zero exit, which fails the test with the stdout
  // naming the drifted file.
  let output = ''
  try {
    output = execFileSync('python3', [gen, '--check'], { encoding: 'utf8' })
  } catch (err) {
    assert.fail(
      `Keycloak realm redirect URIs are out of sync with scripts/stack-derive.sh. ` +
      `Run: python3 scripts/gen-keycloak-redirects.py\n${err.stdout || ''}${err.stderr || ''}`,
    )
  }
  assert.equal(output.trim(), '', 'expected no drift output from --check')
})
