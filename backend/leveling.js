// Experience, levels, and prestige.
//
// Pure — no database, no network, no clock — so it can be unit tested directly.
// The curve lives only here; the client displays the numbers the server sends,
// which keeps a single source of truth for what a level costs.

// XP awarded per correctly typed character (spaces/Backspace are excluded by
// the caller before this is applied).
export const XP_PER_CORRECT = 1;

// Practice (including drills and AI passages) earns double.
export const PRACTICE_MULTIPLIER = 2;

// Highest reachable level. At 100 a player may choose to prestige.
export const MAX_LEVEL = 100;

// Curve constant. totalXpToReach(level) = CURVE_A * (level - 1)^2, so each level
// costs more than the last (increments grow linearly) and level 100 lands at
// ~98,000 XP. Change this one number to make the whole curve easier or harder.
export const CURVE_A = 10;

// XP at which level 100 is reached; also the cap, since XP earned while sitting
// at 100 is discarded on prestige anyway.
export const MAX_XP = CURVE_A * (MAX_LEVEL - 1) ** 2;

/** Total XP needed to reach `level`. Level 1 costs 0. */
export function totalXpToReach(level) {
  if (level <= 1) return 0;
  return CURVE_A * (level - 1) ** 2;
}

/** XP needed to go from `level` to `level + 1`. Null at the cap. */
export function xpToNext(level) {
  if (level >= MAX_LEVEL) return null;
  return CURVE_A * (2 * level - 1);
}

/** Highest level fully reached by `xp`, capped at MAX_LEVEL. */
export function levelFromXp(xp) {
  const safe = Math.max(0, xp);
  let level = Math.floor(Math.sqrt(safe / CURVE_A)) + 1;
  // Correct for floating-point drift around perfect squares.
  while (level < MAX_LEVEL && totalXpToReach(level + 1) <= safe) level += 1;
  while (level > 1 && totalXpToReach(level) > safe) level -= 1;
  return Math.min(level, MAX_LEVEL);
}

/** XP earned inside the current level, for a progress bar. */
export function xpIntoLevel(xp) {
  return Math.max(0, xp) - totalXpToReach(levelFromXp(xp));
}

/** XP required to complete `level`, or null when maxed. */
export function xpForNextLevel(level) {
  return xpToNext(level);
}

/** True when the player has reached MAX_LEVEL and may prestige. */
export function canPrestige(xp) {
  return levelFromXp(xp) >= MAX_LEVEL;
}

/**
 * Add `earned` XP to a player's progress.
 *
 * Clamped at MAX_XP: XP earned while sitting at level 100 is thrown away on
 * prestige regardless, and clamping keeps the progress bar meaningful. Returns
 * the new state plus whether the level changed.
 */
export function applyXp({ xp, lifetimeXp = 0 }, earned) {
  const gain = Math.max(0, earned);
  const previousLevel = levelFromXp(xp);
  const nextXp = Math.min(MAX_XP, Math.max(0, xp) + gain);
  const level = levelFromXp(nextXp);

  return {
    xp: nextXp,
    lifetimeXp: Math.max(0, lifetimeXp) + gain,
    level,
    leveledUp: level > previousLevel,
  };
}
