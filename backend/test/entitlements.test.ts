import { test } from 'node:test';
import assert from 'node:assert/strict';

// Must be set before ./database.js is evaluated: it opens the DB at import.
process.env.DB_PATH = ':memory:';
// Ignore any FREE_LLM_DAILY_LIMIT from the shell so the default (3) is pinned.
delete process.env.FREE_LLM_DAILY_LIMIT;

const { initDb } = await import('../database.js');
const { getEntitlements, peekQuota, consumeQuota, setPremium } = await import(
  '../entitlements.js'
);

initDb();

const NOW = new Date('2026-01-15T10:00:00.000Z');

test('guests have no entitlement', () => {
  assert.equal(getEntitlements(null).plan, 'guest');
  assert.equal(peekQuota(null, 'llm_practice').allowed, false);
});

test('a free user gets the default daily allowance', () => {
  const peek = peekQuota('free-1', 'llm_practice', NOW);
  assert.equal(peek.plan, 'free');
  assert.equal(peek.limit, 3);
  assert.equal(peek.remaining, 3);

  const first = consumeQuota('free-1', 'llm_practice', NOW);
  assert.equal(first.allowed, true);
  assert.equal(first.used, 1);
  assert.equal(first.remaining, 2);
});

test('the free allowance is capped', () => {
  const user = 'free-2';
  assert.equal(consumeQuota(user, 'llm_practice', NOW).allowed, true);
  assert.equal(consumeQuota(user, 'llm_practice', NOW).allowed, true);
  assert.equal(consumeQuota(user, 'llm_practice', NOW).allowed, true);

  const over = consumeQuota(user, 'llm_practice', NOW);
  assert.equal(over.allowed, false);
  assert.equal(over.used, 3);
  assert.equal(over.remaining, 0);
});

test('the allowance rolls over on the next UTC day', () => {
  const user = 'roll-1';
  const day1 = new Date('2026-01-15T23:00:00.000Z');
  const day2 = new Date('2026-01-16T01:00:00.000Z');

  consumeQuota(user, 'llm_practice', day1);
  assert.equal(peekQuota(user, 'llm_practice', day1).used, 1);
  assert.equal(peekQuota(user, 'llm_practice', day2).used, 0);
  assert.equal(peekQuota(user, 'llm_practice', day2).remaining, 3);
});

test('premium is unlimited and its usage is still counted', () => {
  const user = 'prem-1';
  setPremium(user, { premium: true });

  const peek = peekQuota(user, 'llm_practice', NOW);
  assert.equal(peek.plan, 'premium');
  assert.equal(peek.limit, null);
  assert.equal(peek.allowed, true);

  const consumed = consumeQuota(user, 'llm_practice', NOW);
  assert.equal(consumed.allowed, true);
  assert.equal(consumed.used, 1);
});

test('an expired premium falls back to free', () => {
  const user = 'prem-2';
  setPremium(user, { premium: true, until: '2026-01-01T00:00:00.000Z' });

  assert.equal(getEntitlements(user, NOW).plan, 'free');
  assert.equal(peekQuota(user, 'llm_practice', NOW).limit, 3);
});
