#!/usr/bin/env node
// Coverage-floor gate (production-lifecycle plan, Phase 5.1).
//
// Enforces a per-surface coverage floor ONLY where unit coverage is the right
// measure of correctness. Surfaces whose correctness is proven by a higher layer
// (Portal by Playwright E2E; Resolver API by Testcontainers integration) are NOT
// floored on a misleading unit-line number — their gate is that proving layer
// running green, enforced by `make validate` layers 3 and 4. This mirrors the
// justified policy in aidlc-docs/.../coverage-matrix.md ("measured, not guessed").
//
// Usage: node scripts/check-coverage-floors.mjs
// Expects the unit-measured surfaces' coverage-summary.json to already exist
// (run `make coverage-node-sdk` first, or `make coverage` for all).

import { readFileSync, existsSync } from 'node:fs';

// Surfaces floored on unit coverage. lines/branches are percent floors.
const UNIT_FLOORED = [
  {
    name: 'node-sdk',
    summary: 'sdks/node/coverage/coverage-summary.json',
    lines: 90,
    branches: 80,
    produce: 'make coverage-node-sdk',
  },
];

// Surfaces deliberately NOT unit-floored — gated by their proving layer instead.
const LAYER_GATED = [
  { name: 'portal', provedBy: 'Playwright E2E (make test / specs 03-27)' },
  { name: 'resolver', provedBy: 'Testcontainers integration (make test-integration)' },
];

let failed = false;

for (const s of UNIT_FLOORED) {
  if (!existsSync(s.summary)) {
    console.error(
      `FAIL ${s.name}: no coverage summary at ${s.summary}. Run \`${s.produce}\` first.`,
    );
    failed = true;
    continue;
  }
  const total = JSON.parse(readFileSync(s.summary, 'utf8')).total;
  const linePct = total.lines.pct;
  const branchPct = total.branches.pct;
  const lineOk = linePct >= s.lines;
  const branchOk = branchPct >= s.branches;
  if (!lineOk || !branchOk) failed = true;
  console.log(
    `${lineOk && branchOk ? 'PASS' : 'FAIL'} ${s.name}: ` +
      `lines ${linePct}% (floor ${s.lines}%), branches ${branchPct}% (floor ${s.branches}%)`,
  );
}

for (const s of LAYER_GATED) {
  console.log(`SKIP ${s.name}: unit floor N/A — proven by ${s.provedBy}.`);
}

if (failed) {
  console.error('\nCoverage floor gate FAILED. See per-surface lines above.');
  process.exit(1);
}
console.log('\nCoverage floor gate passed.');
