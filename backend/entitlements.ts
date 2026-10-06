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

import type { RequestHandler } from 'express';

import { db, ensureUser } from './database.js';

export const FEATURES = ['llm_practice'] as const;

export type Feature = (typeof FEATURES)[number];

export interface PlanState {
  plan: 'free' | 'premium';
  premium: boolean;
  premiumUntil: string | null;
}

export interface QuotaSnapshot {
  feature: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  resets_at: string;
}

/** The state returned by peek/consume: the snapshot plus whether it is allowed. */
export interface QuotaResult {
  allowed: boolean;
  plan: 'guest' | 'free' | 'premium';
  premium: boolean;
  feature: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  resets_at: string;
}

export interface Entitlements {
  plan: 'guest' | 'free' | 'premium';
  premium: boolean;
  premium_until: string | null;
  usage: Record<string, QuotaSnapshot>;
}

interface PlanRow {
  plan: string;
  premium_until: string | null;
}

/** Free-tier daily allowance for a feature. Premium is unlimited (null). */
function freeLimit(feature: string): number {
  if (feature === 'llm_practice') {
    return Number(process.env.FREE_LLM_DAILY_LIMIT || 3);
  }
  return 0;
}

/**
 * UTC day bucket. Deliberately UTC: one boundary for everyone, and no timezone
 * to store or reason about. A user's allowance rolls over at midnight UTC.
 */
function currentPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function periodResetAt(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
}

/**
 * A plan is premium only while `premium_until` is absent or in the future.
 * An unparseable date fails closed, which is the safe direction.
 */
function isPremium(row: PlanRow | undefined, now = new Date()): boolean {
  if (!row || row.plan !== 'premium') return false;
  if (!row.premium_until) return true;
  return Date.parse(row.premium_until) > now.getTime();
}

function planOf(userId: string, now = new Date()): PlanState {
  const row = db
    .prepare<[string], PlanRow>('SELECT plan, premium_until FROM users WHERE id = ?')
    .get(userId);
  const premium = isPremium(row, now);
  return {
    plan: premium ? 'premium' : 'free',
    premium,
    premiumUntil: premium ? row?.premium_until || null : null,
  };
}

function quotaSnapshot(
  userId: string,
  feature: string,
  plan: PlanState,
  now = new Date()
): QuotaSnapshot {
  const limit = plan.premium ? null : freeLimit(feature);
  const used =
    db
      .prepare<[string, string, string], { used: number }>(
        `SELECT used FROM usage_counters
          WHERE user_id = ? AND feature = ? AND period_start = ?`
      )
      .get(userId, feature, currentPeriod(now))?.used ?? 0;

  return {
    feature,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resets_at: periodResetAt(now),
  };
}

/** Full entitlement state for a user, including current usage. */
export function getEntitlements(userId: string | null, now = new Date()): Entitlements {
  if (!userId) {
    return { plan: 'guest', premium: false, premium_until: null, usage: {} };
  }

  ensureUser(userId);
  const plan = planOf(userId, now);

  return {
    plan: plan.plan,
    premium: plan.premium,
    premium_until: plan.premiumUntil,
    usage: Object.fromEntries(
      FEATURES.map((f) => [f, quotaSnapshot(userId, f, plan, now)])
    ),
  };
}

/**
 * Check the allowance and consume one unit. Returns the snapshot plus
 * `allowed`, so a caller can respond with the remaining quota in one round trip
 * instead of following up with a second request.
 */
export function consumeQuota(
  userId: string | null,
  feature: string,
  now = new Date()
): QuotaResult {
  if (!userId) {
    return {
      allowed: false,
      plan: 'guest',
      premium: false,
      feature,
      used: 0,
      limit: 0,
      remaining: 0,
      resets_at: periodResetAt(now),
    };
  }

  ensureUser(userId);
  const plan = planOf(userId, now);
  const before = quotaSnapshot(userId, feature, plan, now);

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
  ).run(userId, feature, currentPeriod(now));

  return {
    allowed: true,
    ...plan,
    ...quotaSnapshot(userId, feature, plan, now),
  };
}

/**
 * Read the allowance without consuming any of it.
 *
 * Used to reject a request up front, before doing expensive work that the user
 * would then be charged for even if it failed.
 */
export function peekQuota(
  userId: string | null,
  feature: string,
  now = new Date()
): QuotaResult {
  if (!userId) {
    return {
      allowed: false,
      plan: 'guest',
      premium: false,
      feature,
      used: 0,
      limit: 0,
      remaining: 0,
      resets_at: periodResetAt(now),
    };
  }

  ensureUser(userId);
  const plan = planOf(userId, now);
  const snapshot = quotaSnapshot(userId, feature, plan, now);

  return {
    allowed: snapshot.limit === null || snapshot.used < snapshot.limit,
    ...plan,
    ...snapshot,
  };
}

/**
 * Express middleware gating a route behind a metered feature. Attach with
 * requireQuota('llm_practice'); the result is left on req.quota for the handler
 * to echo back.
 *
 * NOTE: this consumes *before* the handler runs. Do not use it for a route that
 * can fail after the check — a provider outage would silently cost the user one
 * of their daily allowances. Use peekQuota() and consume on success instead.
 */
export function requireQuota(feature: string): RequestHandler {
  return (req, res, next) => {
    const quota = consumeQuota(req.userId ?? null, feature);

    if (!quota.allowed) {
      res.status(429).json({
        code: 'quota_exceeded',
        detail: `Your free plan includes ${quota.limit} per day.`,
        quota,
      });
      return;
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
export function setPremium(
  userId: string,
  { premium, until = null }: { premium: boolean; until?: string | null }
): void {
  ensureUser(userId);
  db.prepare('UPDATE users SET plan = ?, premium_until = ? WHERE id = ?').run(
    premium ? 'premium' : 'free',
    premium ? until : null,
    userId
  );
}
