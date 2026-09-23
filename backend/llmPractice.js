// LLM-generated practice passages.
//
// Generates a short passage of natural text engineered to be dense in a user's
// weakest bigrams. The passage is returned as a list of words, which is exactly
// what the existing practice pipeline already consumes — no frontend rendering
// changes are needed.
//
// Two things make this affordable and fast:
//
//   1. The output is a pure function of the target bigrams, so passages are
//      cached by a hash of those bigrams. Repeat requests cost one database
//      read, and users who share a weakness profile share a passage.
//   2. Invalid output is never cached. One bad passage would otherwise be
//      served to everyone with that profile, so validation runs first.
//
// The pure prompt/validation helpers live in llmValidation.js. This module owns
// the I/O: the cache table and the OpenRouter request.

import { db } from './database.js';
import {
  normalizeToAscii,
  validatePassage,
  profileKey,
  buildPrompt,
  SYSTEM_PROMPT,
} from './llmValidation.js';

// Re-exported so callers that imported these from here keep working after the
// split. New code should import from llmValidation.js directly.
export { normalizeToAscii, validatePassage, profileKey };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 8000);

/**
 * Token budget for one generation.
 *
 * Reasoning models bill their "thinking" as completion tokens, and on a
 * constrained writing task that can be dozens of times the length of the
 * passage itself. Budget well above the passage and let the finish_reason check
 * below catch anything that still overruns.
 */
function maxTokensFor(wordCount) {
  const override = Number(process.env.LLM_MAX_TOKENS);
  if (override > 0) return override;
  return Math.max(512, Math.ceil(wordCount * 8));
}

function resolveModel() {
  const model = process.env.LLM_MODEL;
  if (!model) {
    throw new Error(
      'LLM_MODEL is not set. Pick a model slug from https://openrouter.ai/models ' +
        '(they are priced per model and change often, so this is deliberately not defaulted).'
    );
  }
  return model;
}

export function getCachedPassage(key) {
  return (
    db
      .prepare(
        `SELECT profile_key, text, bigrams, model, word_count, prompt_tokens,
                completion_tokens, cost, created_at
           FROM llm_passages WHERE profile_key = ?`
      )
      .get(key) ?? null
  );
}

function savePassage({ key, text, targeted, model, wordCount, usage }) {
  db.prepare(
    `INSERT INTO llm_passages
       (profile_key, text, bigrams, model, word_count, prompt_tokens, completion_tokens, cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_key) DO NOTHING`
  ).run(
    key,
    text,
    JSON.stringify(targeted.map((b) => b.bigram)),
    model,
    wordCount,
    usage?.prompt_tokens ?? null,
    usage?.completion_tokens ?? null,
    usage?.cost ?? null
  );
}

async function callOpenRouter({ targeted, wordCount, strict, fetchImpl = fetch }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = resolveModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const maxTokens = maxTokensFor(wordCount);

  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Optional: only used for OpenRouter's public rankings.
        'HTTP-Referer': 'https://typingseal.com',
        'X-OpenRouter-Title': 'typingSeal',
      },
      body: JSON.stringify({
        model,
        temperature: strict ? 0.4 : 0.8,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt({ targeted, wordCount, strict }) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
    }

    const json = await response.json();
    const choice = json?.choices?.[0];
    const usage = json?.usage ?? null;
    const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;

    // A truncated passage can still satisfy the length and bigram checks while
    // stopping mid-sentence, so it must never reach the cache.
    if (choice?.finish_reason === 'length') {
      throw new Error(
        `output truncated at max_tokens=${maxTokens}` +
          (reasoningTokens > 0
            ? ` (${reasoningTokens} tokens spent reasoning — this model is a poor fit)`
            : '')
      );
    }

    const text = choice?.message?.content;
    if (typeof text !== 'string' || text.trim() === '') {
      throw new Error(
        'OpenRouter returned no text' +
          (reasoningTokens > 0
            ? ` (${reasoningTokens} tokens went to reasoning before any output)`
            : '')
      );
    }

    // Usage and cost are always included; no request parameter needed.
    return { text, model, usage, reasoningTokens };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get a passage for a weakness profile: cache first, then generate.
 *
 * Never throws. Returns `{ text: null, error }` when it cannot produce a
 * validated passage, so the caller can fall back to the deterministic
 * generator rather than failing the request.
 *
 * `fetchImpl` is injectable so tests can drive this without touching the network.
 */
export async function getLlmPractice({ targeted, wordCount, fetchImpl = fetch }) {
  if (!targeted || targeted.length === 0) {
    return { text: null, cached: false, error: 'no target bigrams' };
  }

  let model;
  try {
    model = resolveModel();
  } catch (err) {
    return { text: null, cached: false, error: err.message };
  }

  const key = profileKey(targeted, wordCount, model);

  const cached = getCachedPassage(key);
  if (cached) {
    return { text: cached.text, cached: true, key, model: cached.model };
  }

  let lastProblems = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const strict = attempt > 1;
    let result;
    try {
      result = await callOpenRouter({ targeted, wordCount, strict, fetchImpl });
    } catch (err) {
      // Provider failure: no point retrying with a stricter prompt.
      return { text: null, cached: false, key, error: err.message };
    }

    const normalized = normalizeToAscii(result.text);
    const check = validatePassage(normalized, targeted, wordCount);

    if (check.ok) {
      savePassage({
        key,
        text: normalized,
        targeted,
        model: result.model,
        wordCount,
        usage: result.usage,
      });

      const cost = result.usage?.cost;
      console.log(
        `[llm] generated ${normalized.split(' ').length} words for ${targeted.length} target(s)` +
          ` — ${result.usage?.prompt_tokens ?? '?'}+${result.usage?.completion_tokens ?? '?'} tokens` +
          `${result.reasoningTokens ? ` (${result.reasoningTokens} reasoning)` : ''}` +
          `${cost != null ? `, cost ${cost}` : ''}${strict ? ' (strict retry)' : ''}`
      );

      return { text: normalized, cached: false, key, model: result.model, usage: result.usage };
    }

    lastProblems = check.problems;
    console.warn(
      `[llm] attempt ${attempt} rejected: ${check.problems.join('; ')}` +
        // Seeing WHAT was rejected is the only way to tell a correct rejection
        // (word salad) from a false one (good prose, unlucky metric).
        (process.env.LLM_DEBUG
          ? `\n[llm] rejected text: ${normalized}` +
            `\n[llm] function ratio ${check.functionRatio.toFixed(2)},` +
            ` ${check.hits} bigram hits in ${normalized.split(' ').length} words`
          : '')
    );
  }

  return { text: null, cached: false, key, error: lastProblems.join('; ') };
}
