import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WORD_BANK,
  extractBigrams,
  scoreWord,
  shuffle,
  generatePractice,
} from '../practice.js';

const BANK = new Set(WORD_BANK);

function stats(bigrams, totalSessions = 5) {
  return { total_sessions: totalSessions, bigrams };
}

function bigram(name, errorRate, total = 10, errors = 3) {
  return { bigram: name, error_rate: errorRate, total_occurrences: total, errors };
}

test('extractBigrams returns each adjacent pair', () => {
  assert.deepEqual(extractBigrams('abc'), ['ab', 'bc']);
  assert.deepEqual(extractBigrams('a'), []);
});

test('shuffle permutes without mutating its input', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const out = shuffle(input);
  assert.deepEqual(input, ['a', 'b', 'c', 'd', 'e']); // unchanged
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort(), [...input].sort());
});

test('scoreWord weights the worst bigram higher', () => {
  const weights = { gh: 10, ck: 10 };
  assert.equal(scoreWord('high', weights, 'gh'), 15); // 10 * 1.5
  assert.equal(scoreWord('clock', weights, 'gh'), 10);
  // Two matching bigrams earn a 1.2x bonus: (10*1.5 + 10) * 1.2.
  assert.equal(scoreWord('ghck', weights, 'gh'), 30);
});

test('generatePractice asks for more data when there is no history', () => {
  const result = generatePractice({ stats: stats([], 0), count: 10, wordCount: 20 });
  assert.match(result.error, /Complete at least one/);
  assert.deepEqual(result.practice_words, []);
});

test('generatePractice falls back to random words with too little data', () => {
  const result = generatePractice({
    stats: stats([bigram('gh', 20)], 3),
    count: 10,
    wordCount: 20,
  });
  assert.ok(result.warning);
  assert.equal(result.practice_words.length, 20);
  assert.equal(new Set(result.practice_words).size, 20);
  assert.ok(result.practice_words.every((w) => BANK.has(w)));
});

test('generatePractice only targets bigrams the word bank can produce', () => {
  const result = generatePractice({
    stats: stats([
      bigram('d,', 90), // quote-mode punctuation, impossible for bank words
      bigram('gh', 30),
      bigram('ck', 25),
      bigram('ng', 20),
    ]),
    count: 10,
    wordCount: 30,
  });

  const targeted = result.targeted_bigrams.map((b) => b.bigram);
  assert.ok(!targeted.includes('d,'));
  assert.ok(targeted.includes('gh'));
  assert.equal(result.practice_words.length, 30);
  assert.equal(new Set(result.practice_words).size, 30); // no word repeated
  assert.ok(result.practice_words.every((w) => BANK.has(w)));
  assert.ok(result.drill_text.length > 0);
});

test('generatePractice dedupes case-insensitive duplicate targets', () => {
  const result = generatePractice({
    stats: stats([bigram('Th', 40), bigram('th', 35), bigram('ck', 30), bigram('ng', 25)]),
    count: 10,
    wordCount: 25,
  });
  const thTargets = result.targeted_bigrams.filter((b) => b.bigram.toLowerCase() === 'th');
  assert.equal(thTargets.length, 1);
});
