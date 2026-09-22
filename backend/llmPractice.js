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

import crypto from 'crypto';

import { db } from './database.js';

// Bump this to invalidate every cached passage — e.g. after changing the prompt.
const PROMPT_VERSION = 3;

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

// Validation thresholds.
const MIN_COVERAGE = 0.6; // fraction of target bigrams that must appear at all
const MIN_DENSITY = 0.25; // target-bigram occurrences per word
const MIN_UNIQUE_RATIO = 0.5; // unique words / total words
const LENGTH_TOLERANCE = { low: 0.7, high: 1.4 };

/**
 * Minimum share of function words (the, of, and, to...).
 *
 * Natural English prose runs about 35-45%. A passage assembled purely to hit
 * bigrams falls far below — it stops being language while still scoring well on
 * density, which is the one failure density alone cannot see:
 *
 *   "Night packing brings bright, tough, light, long, plain, placid thoughts."
 *
 * That scores 41 bigram hits in 35 words and reads like nothing at all.
 *
 * Measured against the real quote corpus these passages sit beside, natural
 * prose runs about 40% (30-50%), so this threshold is deliberately lenient.
 */
const MIN_FUNCTION_RATIO = Number(process.env.LLM_MIN_FUNCTION_RATIO || 0.2);

const FUNCTION_WORDS = new Set(
  `a an the and or but if of to in on at by for with from as is are was were be been being am
   it its this that these those i you he she we they me him her us them my your his their our
   not no so than then there when where which who whom what how all any both each few more
   most other some such only own same too very can will just should now have has had do does
   did would could may might must into over under up down out about after before between
   through during without against because while until again once here why`
    .split(/\s+/)
    .filter(Boolean)
);

// Printable ASCII the typing test can actually consume. Anything else — curly
// quotes, em dashes, accented letters — is untypeable on a normal keyboard.
const ALLOWED_CHARS = /^[A-Za-z .,!?;:'"-]$/;

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

/** Count non-overlapping-safe occurrences of a bigram in lowercase text. */
function countBigram(text, bigram) {
  let count = 0;
  let index = text.indexOf(bigram);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(bigram, index + 1);
  }
  return count;
}

/**
 * Force text into printable ASCII. Curly quotes and dashes are the usual
 * offenders — a model will happily emit them, and the user then cannot type them.
 */
export function normalizeToAscii(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '') // zero-width
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decide whether a generated passage is fit to cache and serve.
 *
 * Rejecting is cheap; serving junk to every user with the same profile is not.
 */
export function validatePassage(text, targeted, wordCount) {
  const problems = [];
  const bigrams = targeted.map((b) => String(b.bigram).toLowerCase());

  const badChars = [...new Set(text.split('').filter((c) => !ALLOWED_CHARS.test(c)))];
  if (badChars.length > 0) {
    problems.push(`untypeable characters: ${badChars.join(' ')}`);
  }

  const words = text.split(' ').filter(Boolean);

  const minWords = Math.floor(wordCount * LENGTH_TOLERANCE.low);
  const maxWords = Math.ceil(wordCount * LENGTH_TOLERANCE.high);
  if (words.length < minWords || words.length > maxWords) {
    problems.push(`length ${words.length} outside ${minWords}-${maxWords} words`);
  }

  const lower = text.toLowerCase();
  const counts = Object.fromEntries(bigrams.map((bg) => [bg, countBigram(lower, bg)]));
  const present = bigrams.filter((bg) => counts[bg] > 0).length;
  const hits = Object.values(counts).reduce((sum, n) => sum + n, 0);

  if (bigrams.length > 0) {
    const coverage = present / bigrams.length;
    if (coverage < MIN_COVERAGE) {
      problems.push(
        `covered ${present}/${bigrams.length} targets (need ${Math.ceil(
          MIN_COVERAGE * bigrams.length
        )})`
      );
    }

    const density = words.length > 0 ? hits / words.length : 0;
    if (density < MIN_DENSITY) {
      problems.push(`density ${density.toFixed(2)} below ${MIN_DENSITY}`);
    }
  }

  // Distinct words with punctuation stripped. Computed once and reused by the
  // three checks below.
  const distinct = [
    ...new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))),
  ].filter(Boolean);

  // Catches the "one word repeated to fill space" failure that the deterministic
  // generator had to guard against too.
  const uniqueRatio = words.length > 0 ? distinct.length / words.length : 0;
  if (uniqueRatio < MIN_UNIQUE_RATIO) {
    problems.push(`only ${distinct.length} unique words of ${words.length}`);
  }

  // A bare bigram padded in as a token ("every ng night") is not a word. Every
  // real English word contains a vowel.
  const notWords = distinct.filter((w) => !/[aeiouy]/.test(w));
  if (notWords.length > 0) {
    problems.push(`not words: ${notWords.join(' ')}`);
  }

  // Naturalness. Without this, density alone rewards gibberish.
  const functionWordCount = words.filter((w) =>
    FUNCTION_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
  ).length;
  const functionRatio = words.length > 0 ? functionWordCount / words.length : 0;
  if (functionRatio < MIN_FUNCTION_RATIO) {
    problems.push(
      `only ${(functionRatio * 100).toFixed(0)}% function words ` +
        `(need ${(MIN_FUNCTION_RATIO * 100).toFixed(0)}%)`
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    counts,
    hits,
    words,
    functionRatio,
  };
}

/**
 * Cache key for a passage: prompt version + model + the target bigrams + the
 * requested length. Sorted so the same set always hashes the same way.
 *
 * The model is part of the key on purpose — switching models should produce new
 * passages rather than quietly serving the old model's output.
 */
export function profileKey(targeted, wordCount, model = resolveModel()) {
  const bigrams = targeted
    .map((b) => String(b.bigram).toLowerCase())
    .sort()
    .join(',');
  return crypto
    .createHash('sha256')
    .update(`${PROMPT_VERSION}|${model}|${wordCount}|${bigrams}`)
    .digest('hex')
    .slice(0, 32);
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

function buildPrompt({ targeted, wordCount, strict }) {
  const bigrams = targeted.map((b) => String(b.bigram).toLowerCase());
  return [
    `Write a natural, readable passage of about ${wordCount} words using common everyday English.`,
    '',
    `It must be unusually rich in these letter pairs: ${bigrams.join(', ')}`,
    '',
    // Measured: giving the model a subject IMPROVES quality. With only a bigram
    // constraint it degenerates into word salad — "Night packing brings bright,
    // tough, light, long, plain, placid thoughts." — whereas with a topic it
    // writes real sentences. The cost is roughly 20% of the bigram density.
    'Where it fits naturally, the passage should be about seals (the marine animal).',
    'Never force the theme at the cost of readability.',
    '',
    'Rules:',
    '- Plain ASCII only: letters, spaces, and the punctuation . , ! ? ; : \' " -',
    '- No digits, no curly quotes, no em dashes, no accented characters',
    '- No title, no heading, no surrounding quotation marks',
    // Function words are the most frequent words in English, so a flat "no
    // repeats" rule caps them and drags the passage toward a list of nouns.
    // Measured: this single rule took the function-word share from 11% (0/4
    // runs passing validation) to 35% (4/4) with no loss of bigram coverage.
    '- Output the passage and nothing else',
    strict
      ? `- Every one of these pairs must appear at least twice if it is realistic: ${bigrams.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM_PROMPT =
  'You write short typing-practice passages. You reply with the passage only: ' +
  'no preamble, no explanation, no quotation marks around it.';

async function callOpenRouter({ targeted, wordCount, strict }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const model = resolveModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const maxTokens = maxTokensFor(wordCount);

  try {
    const response = await fetch(OPENROUTER_URL, {
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
 */
export async function getLlmPractice({ targeted, wordCount }) {
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
      result = await callOpenRouter({ targeted, wordCount, strict });
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
