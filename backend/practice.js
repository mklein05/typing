import { getBigramStats } from './database.js';

export const WORD_BANK = [
  "about", "above", "across", "action", "after", "again", "against",
  "almost", "along", "already", "always", "among", "animal", "another",
  "answer", "appear", "around", "asked", "away", "back", "became",
  "because", "become", "before", "behind", "being", "below", "better",
  "between", "black", "blood", "board", "brought", "build", "built",
  "called", "came", "carry", "cause", "center", "certain", "change",
  "children", "church", "circle", "clear", "close", "cold", "common",
  "complete", "contain", "could", "country", "course", "cover", "create",
  "dark", "death", "decide", "deep", "develop", "different", "direct",
  "distant", "does", "done", "door", "down", "drive", "during", "each",
  "early", "earth", "east", "effect", "either", "enough", "enter",
  "equal", "even", "ever", "every", "example", "experience", "face",
  "fact", "fall", "family", "father", "feel", "feet", "field", "figure",
  "final", "find", "fine", "fire", "first", "five", "floor", "follow",
  "food", "foot", "force", "form", "found", "four", "free", "friend",
  "from", "front", "full", "game", "gave", "girl", "give", "glass",
  "going", "gold", "gone", "good", "great", "green", "ground", "group",
  "grow", "half", "hand", "happen", "hard", "have", "head", "hear",
  "heart", "heavy", "help", "here", "high", "hold", "home", "horse",
  "hour", "house", "however", "human", "hundred", "idea", "important",
  "include", "inside", "instead", "interest", "into", "island", "just",
  "keep", "kind", "knew", "know", "known", "land", "language", "large",
  "last", "later", "learn", "least", "leave", "less", "letter", "life",
  "light", "like", "line", "list", "little", "live", "long", "look",
  "love", "made", "make", "many", "matter", "mean", "might", "mind",
  "money", "month", "more", "morning", "most", "mother", "mountain",
  "move", "much", "music", "must", "name", "near", "need", "never",
  "new", "next", "night", "north", "note", "nothing", "notice", "number",
  "object", "ocean", "once", "only", "open", "order", "other", "our",
  "outside", "over", "own", "page", "paper", "part", "pass", "past",
  "pattern", "people", "perhaps", "period", "person", "picture", "piece",
  "place", "plain", "plan", "plane", "plant", "play", "point", "pose",
  "power", "problem", "produce", "product", "pull", "put", "question",
  "quick", "rain", "reach", "read", "ready", "really", "record", "red",
  "remember", "rest", "right", "river", "road", "rock", "room", "round",
  "rule", "said", "same", "saw", "school", "second", "section", "seen",
  "serve", "several", "shape", "ship", "short", "should", "show", "side",
  "simple", "since", "sing", "slow", "small", "snow", "something",
  "song", "soon", "south", "space", "special", "stand", "star", "start",
  "state", "stay", "step", "still", "stood", "stop", "story", "street",
  "strong", "study", "such", "surface", "system", "table", "take",
  "talk", "teach", "tell", "than", "that", "their", "them", "then",
  "there", "these", "they", "thing", "think", "this", "those", "though",
  "thought", "three", "through", "time", "together", "told", "took",
  "toward", "tree", "true", "try", "turn", "under", "understand",
  "until", "upon", "used", "using", "very", "voice", "wait", "walk",
  "want", "war", "watch", "water", "week", "weight", "well", "went",
  "were", "west", "what", "wheel", "when", "where", "which", "while",
  "white", "whole", "will", "wind", "with", "within", "without",
  "woman", "wonder", "word", "work", "world", "would", "write", "year",
  "young", "your"
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

// Every bigram that appears in at least one word-bank word. Used to discard
// targets the bank cannot produce — e.g. "Th" or "d," from quotes mode. Such
// bigrams score no word at all, so they only waste slots in the target list.
const BANK_BIGRAMS = new Set();
for (const word of WORD_BANK) {
  for (const bg of extractBigrams(word)) BANK_BIGRAMS.add(bg);
}

// Fisher-Yates. Array.sort(() => 0.5 - Math.random()) is biased and produces
// an uneven distribution.
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fallbackWords(count) {
  return shuffle(WORD_BANK).slice(0, Math.min(count, WORD_BANK.length));
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

  // Only target bigrams the word bank can actually produce. Stats include
  // quote-mode bigrams with capitals and punctuation ("Th", "d,") that no
  // lowercase bank word contains; targeting those crowds out usable targets.
  const candidates = weak.filter((b) => BANK_BIGRAMS.has(b.bigram.toLowerCase()));

  // Dedupe case-insensitively ("Th" vs "th"), keeping the worst first.
  const seen = new Set();
  const targeted = [];
  for (const b of (candidates.length > 0 ? candidates : weak)) {
    const key = b.bigram.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    targeted.push(b);
    if (targeted.length >= count) break;
  }

  // Keyed lowercase so bank words (all lowercase) can match.
  const weakDict = Object.fromEntries(
    targeted.map((b) => [b.bigram.toLowerCase(), b.error_rate])
  );
  const worst = targeted[0].bigram.toLowerCase();

  const scored = [];
  for (const word of WORD_BANK) {
    const s = scoreWord(word, weakDict, worst);
    if (s > 0) scored.push({ word, score: s });
  }
  scored.sort((a, b) => b.score - a.score);

  // Build a pool of DISTINCT words — strongest scorers first, then topped up
  // from the word bank. The top-up is essential: if only one bank word matches
  // the targeted bigrams, cycling a bare candidate list would repeat that
  // single word for the whole test.
  const MAX_STRONG = 24;
  const pool = scored.slice(0, MAX_STRONG).map((item) => item.word);

  if (pool.length < wordCount) {
    const chosen = new Set(pool);
    // Prefer other bank words that also exercise a targeted bigram.
    pool.push(
      ...shuffle(
        WORD_BANK.filter(
          (w) => !chosen.has(w) && extractBigrams(w).some((bg) => bg in weakDict)
        )
      )
    );

    // Still short? Top up with any remaining word-bank words.
    if (pool.length < wordCount) {
      const used = new Set(pool);
      pool.push(...shuffle(WORD_BANK.filter((w) => !used.has(w))));
    }
  }

  // Each word appears once unless the bank is smaller than the requested count
  // (impossible with the current word bank and a max of 100 words).
  const practiceWords = [];
  for (let i = 0; i < wordCount; i++) {
    practiceWords.push(pool[i % pool.length]);
  }

  return {
    targeted_bigrams: targeted.map((b) => ({ bigram: b.bigram, error_rate: b.error_rate })),
    practice_words: shuffle(practiceWords),
    drill_text: generateDrill(targeted),
    total_words: practiceWords.length,
    total_bigrams_targeted: targeted.length
  };
}