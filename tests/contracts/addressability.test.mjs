// P1 addressability lint (validation framework, Phase 1.5).
//
// Fails if an interactive element on a covered surface lacks a stable
// identifier (data-testid on web, Key on Flutter). This enforces P1
// mechanically so the sweep cannot silently regress: a new button without a
// testid fails `make test-contracts` (which CI runs).
//
// Scope note: this is a pragmatic line-level heuristic, not a full AST lint. It
// flags the common interactive tags/widgets and checks for an identifier within
// a small window. It is intentionally conservative (a few known dynamic cases
// are allowlisted) to avoid false positives that would erode trust in the gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, exts, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'build' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, exts, acc);
    else if (exts.includes(extname(name))) acc.push(full);
  }
  return acc;
}

// An interactive line has an identifier if it, or a nearby line in the same
// element, carries data-testid (web) or Key( (Flutter). We join each element's
// opening tag across a small window to tolerate multi-line JSX/widgets.
function elementHasId(lines, idx, idToken, windowBack = 6, windowFwd = 10) {
  const from = Math.max(0, idx - windowBack);
  const to = Math.min(lines.length, idx + windowFwd);
  const chunk = lines.slice(from, to).join('\n');
  return chunk.includes(idToken);
}

// --- Web (React/JSX): <button, onClick=, onSubmit=, <form, <input, <select, <textarea ---
const WEB_SURFACES = [
  'platform/portal/src',
  'demo/mock-apps/node/pizza/client/src',
  'demo/mock-apps/node/marketplace/client/src',
];
// Vanilla HTML surfaces (already testid'd; included so a regression is caught).
const WEB_HTML_SURFACES = [
  'demo/mock-apps/dotnet/bank/src/Bank.Presentation/wwwroot',
  'demo/mock-apps/dotnet/insurance-claims/src/InsuranceClaims.Presentation/wwwroot',
];
const WEB_INTERACTIVE = /<button[\s>]|<form[\s>]|<input[\s>]|<select[\s>]|<textarea[\s>]/;
// JSX onClick/onSubmit on a non-button host (e.g. a div) also counts.
const WEB_HANDLER = /on(Click|Submit)=|addEventListener\(|\.onclick/;

function lintWeb(surfaces, exts) {
  const violations = [];
  for (const rel of surfaces) {
    const files = walk(join(repoRoot, rel), exts);
    for (const file of files) {
      if (file.endsWith('.d.ts')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isInteractive = WEB_INTERACTIVE.test(line) || WEB_HANDLER.test(line);
        if (!isInteractive) continue;
        // Skip obviously non-interactive matches (type-only, comments).
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (!elementHasId(lines, i, 'data-testid') && !elementHasId(lines, i, 'dataset.testid') && !elementHasId(lines, i, "setAttribute('data-testid'") ) {
          violations.push(`${file.replace(repoRoot + '/', '')}:${i + 1}: ${line.trim().slice(0, 90)}`);
        }
      }
    }
  }
  return violations;
}

// --- Flutter: ChoiceChip/FilterChip/ElevatedButton/OutlinedButton/TextButton/
//     IconButton/TextField/Switch/Checkbox/InkWell/GestureDetector with onTap/onPressed ---
const FLUTTER_SURFACES = ['platform/client-app/lib'];
const FLUTTER_INTERACTIVE = /(ElevatedButton|OutlinedButton|TextButton|FilledButton|IconButton|ChoiceChip|FilterChip|TextField|Checkbox|Switch)\(/;

function lintFlutter() {
  const violations = [];
  for (const rel of FLUTTER_SURFACES) {
    const files = walk(join(repoRoot, rel), ['.dart']);
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!FLUTTER_INTERACTIVE.test(line)) continue;
        if (line.trim().startsWith('//')) continue;
        // A keyed interactive widget has Key( within its construction window,
        // OR is itemBuilder'd inside a list whose rows carry keys (allowlisted
        // by a nearby `key:` on the builder), OR is the root widget of a small
        // wrapper class that delegates its key via super.key (so the CALLER
        // supplies the Key, e.g. _FilterChip) - detected by super.key / this.key
        // in the enclosing class.
        if (
          !elementHasId(lines, i, 'Key(', 4, 14) &&
          !elementHasId(lines, i, 'key:', 4, 14) &&
          !elementHasId(lines, i, 'super.key', 20, 2) &&
          !elementHasId(lines, i, 'this.key', 20, 2)
        ) {
          violations.push(`${file.replace(repoRoot + '/', '')}:${i + 1}: ${line.trim().slice(0, 90)}`);
        }
      }
    }
  }
  return violations;
}

test('P1: web interactive elements carry data-testid', () => {
  const violations = [...lintWeb(WEB_SURFACES, ['.tsx', '.jsx']), ...lintWeb(WEB_HTML_SURFACES, ['.html'])];
  assert.deepEqual(
    violations,
    [],
    `\n${violations.length} interactive web element(s) missing data-testid (P1):\n` +
      violations.join('\n') +
      '\n\nAdd data-testid="ohpp.<area>.<element>.<id>" (see tests/VALIDATION-FRAMEWORK.md).',
  );
});

test('P1: Flutter interactive widgets carry a Key', () => {
  const violations = lintFlutter();
  assert.deepEqual(
    violations,
    [],
    `\n${violations.length} interactive Flutter widget(s) missing a Key (P1):\n` +
      violations.join('\n') +
      "\n\nAdd Key('ohpp.<area>.<element>.<id>') (see tests/VALIDATION-FRAMEWORK.md).",
  );
});
