// Premium entitlements and metered usage.
//
// Deliberately provider-agnostic: whatever sells the subscription — Paddle,
// Lemon Squeezy, Stripe — all it has to do is call setPremium() from a webhook.
// Nothing in this file knows or cares which one it is.
//
// The local `plan` / `premium_until` pair is the source of truth for checks.
// Not the client, and not the provider: the client can be edited, and a webhook
// can fail to arrive. Expiry is enforced here too, so a missed cancellation
// webhook cannot leave someone premium forever.

import { db, ensureUser } from './database.js';

export const FEATURES = ['llm_practice'];

/** Free-tier daily allowance for a feature. Premium is unlimited (null). */
function freeLimit(feature) {
  if (feature === 'llm_practice') {
    return Number(process.env.FREE_LLM_DAILY_LIMIT || 3);
  }
  return 0;
}

/**
 * UTC day bucket. Deliberately UTC: one boundary for everyone, and no timezone
 * to store or reason about. A user's allowance rolls over at midnight UTC.
 */
function currentPeriod() {
  return new Date().toISOString().slice(0, 10);
}

function periodResetAt() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
}

/**
 * A plan is premium only while `premium_until` is absent or in the future.
 * An unparseable date fails closed, which is the safe direction.
 */
function isPremium(row) {
  if (!row || row.plan !== 'premium') return false;
  if (!row.premium_until) return true;
  return Date.parse(row.premium_until) > Date.now();
}

function planOf(userId) {
  const row = db.prepare('SELECT plan, premium_until FROM users WHERE id = ?').get(userId);
  const premium = isPremium(row);
  return {
    plan: premium ? 'premium' : 'free',
    premium,
    premiumUntil: premium ? row.premium_until || null : null,
  };
}

function quotaSnapshot(userId, feature, plan) {
  const limit = plan.premium ? null : freeLimit(feature);
  const used =
    db
      .prepare(
        `SELECT used FROM usage_counters
          WHERE user_id = ? AND feature = ? AND period_start = ?`
      )
      .get(userId, feature, currentPeriod())?.used ?? 0;

  return {
    feature,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resets_at: periodResetAt(),
  };
}

/** Full entitlement state for a user, including current usage. */
export function getEntitlements(userId) {
  if (!userId) {
    return { plan: 'guest', premium: false, premium_until: null, usage: {} };
  }

  ensureUser(userId);
  const plan = planOf(userId);

  return {
    plan: plan.plan,
    premium: plan.premium,
    premium_until: plan.premiumUntil,
    usage: Object.fromEntries(
      FEATURES.map((f) => [f, quotaSnapshot(userId, f, plan)])
    ),
  };
}

/**
 * Check the allowance and consume one unit. Returns the snapshot plus
 * `allowed`, so a caller can respond with the remaining quota in one round trip
 * instead of following up with a second request.
 */
export function consumeQuota(userId, feature) {
  if (!userId) {
    return {
      allowed: false,
      plan: 'guest',
      premium: false,
      feature,
      used: 0,
      limit: 0,
      remaining: 0,
      resets_at: periodResetAt(),
    };
  }

  ensureUser(userId);
  const plan = planOf(userId);
  const before = quotaSnapshot(userId, feature, plan);

  if (before.limit !== null && before.used >= before.limit) {
    return { allowed: false, ...plan, ...before };
  }

  // Upsert rather than read-then-write. better-sqlite3 is synchronous so this is
  // already atomic, but the single statement stays correct if a future caller
  // becomes concurrent. Premium usage is counted too — it is the only way to
  // see what the feature actually costs.
  db.prepare(
    `INSERT INTO usage_counters (user_id, feature, period_start, used)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, feature, period_start) DO UPDATE SET used = used + 1`
  ).run(userId, feature, currentPeriod());

  return {
    allowed: true,
    ...plan,
    ...quotaSnapshot(userId, feature, plan),
  };
}

/**
 * Express middleware gating a route behind a metered feature. Attach with
 * requireQuota('llm_practice'); the result is left on req.quota for the handler
 * to echo back.
 */
export function requireQuota(feature) {
  return (req, res, next) => {
    const quota = consumeQuota(req.userId, feature);

    if (!quota.allowed) {
      return res.status(429).json({
        code: 'quota_exceeded',
        detail: `Your free plan includes ${quota.limit} per day.`,
        quota,
      });
    }

    req.quota = quota;
    next();
  };
}

/**
 * Set a user's plan. This is the only thing that should ever write these
 * columns — call it from the payment provider's webhook, never from a request
 * the client controls.
 *
 * `until` is an ISO date, or null for a plan that does not expire.
 */
export function setPremium(userId, { premium, until = null }) {
  ensureUser(userId);
  db.prepare('UPDATE users SET plan = ?, premium_until = ? WHERE id = ?').run(
    premium ? 'premium' : 'free',
    premium ? until : null,
    userId
  );
}
