import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeToAscii,
  validatePassage,
  profileKey,
  buildPrompt,
} from '../llmValidation.js';

// 18 words, naturally rich in "th"/"he", with a healthy mix of function words.
const GOOD =
  'the seal has three thin things that they think the other then this these those the there the';

test('normalizeToAscii converts typographic characters to plain ASCII', () => {
  assert.equal(
    normalizeToAscii('He said \u201chi\u201d \u2014 caf\u00e9\u2026'),
    'He said "hi" - cafe...'
  );
});

test('normalizeToAscii strips zero-width characters and collapses whitespace', () => {
  assert.equal(normalizeToAscii('a\u200bb\u00a0\u00a0c   d'), 'ab c d');
});

test('validatePassage accepts a natural passage that hits the targets', () => {
  const result = validatePassage(GOOD, [{ bigram: 'th' }, { bigram: 'he' }], 18);
  assert.equal(result.ok, true, result.problems.join('; '));
});

test('validatePassage rejects untypeable characters', () => {
  const result = validatePassage('the seal\u2019s thin thing', [{ bigram: 'th' }], 5);
  assert.ok(result.problems.some((p) => p.includes('untypeable')));
});

test('validatePassage rejects a passage outside the length tolerance', () => {
  const result = validatePassage('the seal has', [{ bigram: 'th' }], 30);
  assert.ok(result.problems.some((p) => p.includes('length')));
});

test('validatePassage rejects insufficient target coverage', () => {
  const result = validatePassage(GOOD, [{ bigram: 'th' }, { bigram: 'zz' }], 18);
  assert.ok(result.problems.some((p) => p.includes('covered')));
});

test('validatePassage rejects low bigram density', () => {
  const result = validatePassage(
    'the seal ocean water deep blue cold waves salt sand',
    [{ bigram: 'th' }],
    10
  );
  assert.ok(result.problems.some((p) => p.includes('density')));
});

test('validatePassage rejects repeat-to-fill text', () => {
  const result = validatePassage(Array(10).fill('seal').join(' '), [{ bigram: 'se' }], 10);
  assert.ok(result.problems.some((p) => p.includes('unique words')));
});

test('validatePassage rejects bare bigrams padded in as words', () => {
  const result = validatePassage('the ng thing that they think', [{ bigram: 'ng' }], 6);
  assert.ok(result.problems.some((p) => p.includes('not words')));
});

test('validatePassage rejects word salad with too few function words', () => {
  const result = validatePassage(
    'seal ocean water dive swim fish salt waves cold deep blue',
    [{ bigram: 'se' }],
    11
  );
  assert.ok(result.problems.some((p) => p.includes('function words')));
});

test('profileKey is order-independent but model- and length-sensitive', () => {
  const base = profileKey([{ bigram: 'gh' }, { bigram: 'ck' }], 35, 'vendor/model');
  assert.equal(base, profileKey([{ bigram: 'ck' }, { bigram: 'gh' }], 35, 'vendor/model'));
  assert.notEqual(base, profileKey([{ bigram: 'gh' }, { bigram: 'ck' }], 35, 'other/model'));
  assert.notEqual(base, profileKey([{ bigram: 'gh' }, { bigram: 'ck' }], 20, 'vendor/model'));
});

test('buildPrompt only adds the strict line when asked', () => {
  const normal = buildPrompt({ targeted: [{ bigram: 'gh' }], wordCount: 35, strict: false });
  const strict = buildPrompt({ targeted: [{ bigram: 'gh' }], wordCount: 35, strict: true });
  assert.match(normal, /gh/);
  assert.doesNotMatch(normal, /at least twice/);
  assert.match(strict, /at least twice/);
});
