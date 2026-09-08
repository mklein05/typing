import { getBigramStats } from './database.js';

export const WORD_BANK = [
  "about", "above", "across", "action", "after", "again", "against", "almost",
  "along", "already", "always", "among", "animal", "another", "answer", "appear",
  "around", "asked", "away", "back", "became", "because", "become", "before",
  "behind", "being", "below", "better", "between", "black", "blood", "board",
  "brought", "build", "built", "called", "came", "carry", "cause", "center",
  "certain", "change", "children", "church", "circle", "clear", "close", "cold"
];

function extractBigrams(word) {
  const bigrams = [];
  for (let i = 0; i < word.length - 1; i++) {
    bigrams.push(word[i] + word[i + 1]);
  }
  return bigrams;
}

function scoreWord(word, weakBigrams, worstBigram) {
  const bigrams = extractBigrams(word);
  let score = 0.0;
  let matches = 0;

  for (const bg of bigrams) {
    if (bg in weakBigrams) {
      let weight = weakBigrams[bg];
      if (bg === worstBigram) weight *= 1.5;
      score += weight;
      matches += 1;
    }
  }

  if (matches > 1) {
    score *= 1.0 + (matches - 1) * 0.2;
  }
  return score;
}

function generateDrill(weakBigrams, reps = 5) {
  const parts = [];
  for (const bgInfo of weakBigrams) {
    for (let i = 0; i < reps; i++) {
      parts.push(bgInfo.bigram);
    }
  }
  return parts.join('  ');
}

function fallbackWords(count) {
  const shuffled = [...WORD_BANK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, WORD_BANK.length));
}

export function generatePractice(count = 10, wordCount = 35, userId = null) {
  const bigramStats = getBigramStats(userId);
  const allBigrams = bigramStats.bigrams || [];
  const totalSessions = bigramStats.total_sessions || 0;

  if (totalSessions === 0) {
    return {
      error: "Complete at least one typing test first",
      practice_words: [],
      drill_text: "",
      total_words: 0,
      total_bigrams_targeted: 0,
      targeted_bigrams: []
    };
  }

  const weak = allBigrams.filter((b) => b.error_rate > 0);

  if (weak.length < 3) {
    return {
      warning: `Need more typing data. Only found ${weak.length} bigrams with errors. Keep practicing!`,
      targeted_bigrams: weak,
      practice_words: fallbackWords(wordCount),
      drill_text: weak.length > 0 ? generateDrill(weak) : "",
      total_words: wordCount,
      total_bigrams_targeted: weak.length
    };
  }

  const targeted = weak.slice(0, count);
  const weakDict = Object.fromEntries(targeted.map((b) => [b.bigram, b.error_rate]));
  const worst = targeted[0].bigram;

  const scored = [];
  for (const word of WORD_BANK) {
    const s = scoreWord(word, weakDict, worst);
    if (s > 0) scored.push({ word, score: s });
  }
  scored.sort((a, b) => b.score - a.score);

  const practiceWords = [];
  if (scored.length > 0) {
    const topWords = scored.map((item) => item.word);
    let idx = 0;
    while (practiceWords.length < wordCount) {
      practiceWords.push(topWords[idx % topWords.length]);
      idx++;
    }
  } else {
    practiceWords.push(...fallbackWords(wordCount));
  }

  practiceWords.sort(() => 0.5 - Math.random());

  return {
    targeted_bigrams: targeted.map((b) => ({ bigram: b.bigram, error_rate: b.error_rate })),
    practice_words: practiceWords,
    drill_text: generateDrill(targeted),
    total_words: practiceWords.length,
    total_bigrams_targeted: targeted.length
  };
}