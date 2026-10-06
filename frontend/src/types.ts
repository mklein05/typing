// Shared shapes for the backend API responses this app consumes.
//
// Deliberately a frontend copy rather than a shared root module: Railway builds
// each service from its own directory, so a repo-root types module would not be
// in the frontend build context — the same reason the word bank is duplicated.

/** A weak letter pair from `GET /api/stats/bigrams`. */
export interface BigramStat {
  bigram: string;
  total_occurrences: number;
  errors: number;
  error_rate: number;
  avg_interkey_latency_ms: number;
}

/** A weak letter pair chosen for a practice session. */
export interface TargetedBigram {
  bigram: string;
  error_rate: number;
}

export interface BigramStatsResponse {
  bigrams: BigramStat[];
  total_bigrams_analysed: number;
  total_unique_bigrams: number;
  total_sessions: number;
}

/** A per-key stat row from `GET /api/stats/keys`. */
export interface KeyStat {
  key: string;
  total: number;
  errors: number;
  error_rate: number;
  avg_interkey_latency_ms: number;
  avg_hold_duration_ms: number;
}

export interface KeyStatsResponse {
  keys: KeyStat[];
  total_keystrokes_analysed: number;
  total_sessions: number;
}

/** Metered allowance for one feature. `limit`/`remaining` are null when unlimited. */
export interface Quota {
  feature: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  resets_at: string;
}

/** `GET /api/entitlements`. */
export interface Entitlements {
  plan: 'guest' | 'free' | 'premium';
  premium: boolean;
  premium_until: string | null;
  usage: Record<string, Quota>;
}

/** `GET /api/profile` — level is derived server-side from XP. */
export interface Profile {
  username: string | null;
  level: number;
  prestige: number;
  xp: number;
  xp_into_level: number;
  xp_for_next_level: number | null;
  lifetime_xp: number;
  can_prestige: boolean;
  max_level: number;
}

/** `GET /api/practice/generate`, and the base of the LLM response. */
export interface PracticeData {
  error?: string;
  warning?: string;
  practice_words: string[];
  drill_text: string;
  total_words: number;
  total_bigrams_targeted: number;
  targeted_bigrams: TargetedBigram[];
}

/** `POST /api/practice/generate-llm` — the practice base plus engine metadata. */
export interface LlmGenerateResponse extends PracticeData {
  engine?: 'llm' | 'fallback';
  cached?: boolean;
  reason?: string;
  quota?: Quota;
}

/** `POST /api/sessions`. */
export interface SessionResponse {
  session_id: number;
  message: string;
  xp_earned: number;
  level: number | null;
  leveled_up: boolean;
}

export interface Quote {
  id: number;
  text: string;
  source: string;
}

export interface QuotesResponse {
  quotes: Quote[];
  total_available: number;
}
