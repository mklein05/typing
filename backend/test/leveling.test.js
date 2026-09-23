import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CURVE_A,
  MAX_LEVEL,
  MAX_XP,
  totalXpToReach,
  xpToNext,
  levelFromXp,
  xpIntoLevel,
  xpForNextLevel,
  canPrestige,
  applyXp,
} from '../leveling.js';

test('level 1 costs nothing and level 100 is the documented total', () => {
  assert.equal(totalXpToReach(1), 0);
  assert.equal(totalXpToReach(2), CURVE_A);
  assert.equal(totalXpToReach(100), 98010);
  assert.equal(MAX_XP, 98010);
});

test('each level costs more than the previous one', () => {
  assert.equal(xpToNext(1), 10);
  assert.equal(xpToNext(2), 30);
  assert.equal(xpToNext(99), 1970);
  assert.ok(xpToNext(50) > xpToNext(49));
  assert.equal(xpToNext(MAX_LEVEL), null);
});

test('levelFromXp sits exactly on the thresholds', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(9), 1);
  assert.equal(levelFromXp(10), 2);
  assert.equal(levelFromXp(39), 2);
  assert.equal(levelFromXp(40), 3);
  assert.equal(levelFromXp(98010), 100);
  assert.equal(levelFromXp(9_999_999), MAX_LEVEL); // capped
});

test('levelFromXp never decreases as XP grows', () => {
  let previous = 0;
  for (let xp = 0; xp <= 2000; xp += 7) {
    const level = levelFromXp(xp);
    assert.ok(level >= previous, `level dropped at xp=${xp}`);
    previous = level;
  }
});

test('xpIntoLevel reports progress within the current level', () => {
  assert.equal(xpIntoLevel(10), 0); // exactly level 2
  assert.equal(xpIntoLevel(25), 15); // 15 XP into level 2
  assert.equal(xpForNextLevel(2), 30);
  assert.equal(xpForNextLevel(MAX_LEVEL), null);
});

test('applyXp reports level-ups and accumulates lifetime XP', () => {
  const fresh = { xp: 0, lifetimeXp: 0 };

  const nothing = applyXp(fresh, 5);
  assert.equal(nothing.level, 1);
  assert.equal(nothing.leveledUp, false);
  assert.equal(nothing.xp, 5);

  const leveled = applyXp(fresh, 10);
  assert.equal(leveled.level, 2);
  assert.equal(leveled.leveledUp, true);
  assert.equal(leveled.lifetimeXp, 10);

  const multi = applyXp(fresh, 50); // 10 + 30 = 40 reaches level 3
  assert.equal(multi.level, 3);
  assert.equal(multi.leveledUp, true);
});

test('XP is clamped at the level-100 cap', () => {
  const applied = applyXp({ xp: MAX_XP - 5, lifetimeXp: 0 }, 10_000);
  assert.equal(applied.xp, MAX_XP);
  assert.equal(applied.level, MAX_LEVEL);
  assert.equal(applied.lifetimeXp, 10_000); // lifetime is not clamped
});

test('canPrestige is only true at the cap', () => {
  assert.equal(canPrestige(0), false);
  assert.equal(canPrestige(MAX_XP - 1), false);
  assert.equal(canPrestige(MAX_XP), true);
});
