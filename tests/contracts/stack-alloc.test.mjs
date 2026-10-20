import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const alloc = new URL('scripts/stack-alloc.sh', root).pathname

// Run the allocator inside a throwaway worktree dir, sharing a given registry
// (XDG_STATE_HOME) so cross-worktree claims are visible. Returns stdout trimmed.
function runAlloc(worktreeDir, stateHome, explicit) {
  const scriptCopy = join(worktreeDir, 'stack-alloc.sh')
  copyFileSync(alloc, scriptCopy)
  const env = { ...process.env, XDG_STATE_HOME: stateHome, OHPP_ALLOC_SKIP_DOCKER: '1' }
  if (explicit === undefined) delete env.STACK_ID
  else env.STACK_ID = String(explicit)
  return execFileSync('sh', [scriptCopy], { cwd: worktreeDir, env, encoding: 'utf8' }).trim()
}

test('StackAlloc_TwoWorktrees_GetDistinctIds', () => {
  const state = mkdtempSync(join(tmpdir(), 'ohpp-state-'))
  const a = mkdtempSync(join(tmpdir(), 'ohpp-wt-a-'))
  const b = mkdtempSync(join(tmpdir(), 'ohpp-wt-b-'))
  try {
    const idA = runAlloc(a, state, undefined)
    const idB = runAlloc(b, state, undefined)
    // The never-share-data invariant: distinct worktrees never share a STACK_ID.
    assert.notEqual(idA, idB, 'two worktrees must receive distinct STACK_IDs')
    assert.equal(idA, '0', 'first worktree gets the lowest free id')
    assert.equal(idB, '1', 'second worktree gets the next free id')
    // Each pinned its id.
    assert.equal(readFileSync(join(a, '.stack-id'), 'utf8').trim(), '0')
    assert.equal(readFileSync(join(b, '.stack-id'), 'utf8').trim(), '1')
  } finally {
    rmSync(state, { recursive: true, force: true })
    rmSync(a, { recursive: true, force: true })
    rmSync(b, { recursive: true, force: true })
  }
})

test('StackAlloc_PinnedWorktree_ReusesItsId', () => {
  const state = mkdtempSync(join(tmpdir(), 'ohpp-state-'))
  const wt = mkdtempSync(join(tmpdir(), 'ohpp-wt-'))
  try {
    const first = runAlloc(wt, state, undefined)
    const second = runAlloc(wt, state, undefined)
    assert.equal(first, second, 'a worktree reuses its pinned id on repeat runs')
  } finally {
    rmSync(state, { recursive: true, force: true })
    rmSync(wt, { recursive: true, force: true })
  }
})

test('StackAlloc_ExplicitOverride_WinsAndIsNotPinned', () => {
  const state = mkdtempSync(join(tmpdir(), 'ohpp-state-'))
  const wt = mkdtempSync(join(tmpdir(), 'ohpp-wt-'))
  try {
    const id = runAlloc(wt, state, 9)
    assert.equal(id, '9', 'explicit STACK_ID overrides allocation')
    // An explicit override is deliberate and one-off: it must NOT pin a file.
    assert.equal(existsSync(join(wt, '.stack-id')), false, 'override must not pin .stack-id')
  } finally {
    rmSync(state, { recursive: true, force: true })
    rmSync(wt, { recursive: true, force: true })
  }
})
