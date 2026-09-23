// Guards the two duplicated word banks against drift.
//
// backend/practice.js and frontend/src/components/TypingTest.jsx each carry
// their own copy of the word list on purpose: Railway builds each service from
// its own directory, so a module at the repo root would not be in either build
// context. This script is what keeps that duplication honest.
//
// Run from the repo root after editing either list:
//
//     node scripts/check-word-bank.mjs
//
// `findWordBankDrift()` is also imported by backend/test/wordBank.test.js, so
// the same check runs as part of `npm test`.

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readBank(relPath, pattern) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  const match = src.match(pattern);
  if (!match) throw new Error(`Could not find WORD_BANK in ${relPath}`);
  return [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

/**
 * Compare the two copies. Returns `{ backend, frontend, problems }`, where
 * `problems` is empty when they match.
 */
export function findWordBankDrift() {
  const backend = readBank('backend/practice.js', /export const WORD_BANK = \[([\s\S]*?)\];/);
  const frontend = readBank(
    'frontend/src/components/TypingTest.jsx',
    /const WORD_BANK = \[([\s\S]*?)\];/
  );

  const problems = [];
  if (backend.length !== frontend.length) {
    problems.push(`length differs: backend ${backend.length} vs frontend ${frontend.length}`);
  }

  const max = Math.max(backend.length, frontend.length);
  let mismatches = 0;
  for (let i = 0; i < max; i += 1) {
    if (backend[i] !== frontend[i]) {
      mismatches += 1;
      if (mismatches <= 10) {
        problems.push(`index ${i}: backend '${backend[i]}' vs frontend '${frontend[i]}'`);
      }
    }
  }
  if (mismatches > 10) problems.push(`...and ${mismatches - 10} more mismatches`);

  return { backend, frontend, problems };
}

function main() {
  const { backend, problems } = findWordBankDrift();
  if (problems.length > 0) {
    console.error('Word banks have drifted apart:');
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nUpdate both backend/practice.js and frontend/src/components/TypingTest.jsx.');
    process.exit(1);
  }
  console.log(`Word banks match (${backend.length} words).`);
}

// Only run when executed directly, so importing this module is side-effect free.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
