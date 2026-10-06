import { test } from 'node:test';
import assert from 'node:assert/strict';

// The two copies of the word bank live on either side of the frontend/backend
// split, so this reuses the same checker as the standalone CLI script.
import { findWordBankDrift } from '../../scripts/check-word-bank.mjs';

test('the duplicated word banks have not drifted apart', () => {
  const { backend, frontend, problems } = findWordBankDrift();
  assert.deepEqual(problems, []);
  assert.equal(backend.length, frontend.length);
  assert.ok(backend.length > 0);
});
