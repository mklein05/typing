// Pure logic for LLM-generated practice: prompt building and output validation.
//
// Deliberately free of any database or network imports, so it can be unit tested
// in isolation. llmPractice.js owns the I/O (cache reads/writes and the
// OpenRouter request) and imports the helpers from here.

import crypto from 'crypto';

// Bump this to invalidate every cached passage — e.g. after changing the prompt.
export const PROMPT_VERSION = 3;

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

/** Count occurrences of a bigram in lowercase text. */
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
 * passages rather than quietly serving the old model's output. It is passed in
 * (rather than resolved from the environment here) to keep this module pure.
 */
export function profileKey(targeted, wordCount, model) {
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

export function buildPrompt({ targeted, wordCount, strict }) {
  const bigrams = targeted.map((b) => String(b.bigram).toLowerCase());
  return [
    `Write a natural, readable passage of about ${wordCount} words.`,
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

export const SYSTEM_PROMPT =
  'You write short passages. You reply with the passage only: ' +
  'no preamble, no explanation, no quotation marks around it.';
