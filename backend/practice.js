// This list is deliberately duplicated rather than shared: Railway builds each
// service from its own directory, so a module at the repo root would not be in
// the backend build context. The frontend keeps its own copy in
// frontend/src/components/TypingTest.jsx. `node scripts/check-word-bank.mjs`
// fails if the two copies drift apart.
export const WORD_BANK = [
  'a', 'able', 'about', 'above', 'across', 'action', 'add', 'after', 'again', 'against',
  'ago', 'air', 'all', 'almost', 'along', 'already', 'also', 'always', 'among', 'an',
  'and', 'animal', 'another', 'answer', 'any', 'appear', 'area', 'around', 'as', 'ask',
  'asked', 'at', 'away', 'back', 'be', 'beauty', 'became', 'because', 'become', 'before',
  'begin', 'behind', 'being', 'below', 'best', 'better', 'between', 'big', 'bird', 'black',
  'blood', 'blue', 'board', 'boat', 'body', 'book', 'both', 'box', 'bring', 'brought',
  'build', 'built', 'busy', 'but', 'by', 'called', 'came', 'can', 'car', 'care',
  'carry', 'cause', 'center', 'certain', 'change', 'check', 'children', 'church', 'circle', 'city',
  'class', 'clear', 'close', 'cold', 'come', 'common', 'complete', 'contain', 'correct', 'could',
  'country', 'course', 'cover', 'create', 'cry', 'dark', 'day', 'death', 'decide', 'deep',
  'develop', 'different', 'direct', 'distant', 'do', 'does', 'dog', 'done', 'door', 'down',
  'drive', 'dry', 'during', 'each', 'early', 'earth', 'ease', 'east', 'effect', 'either',
  'end', 'enough', 'enter', 'equal', 'equate', 'even', 'ever', 'every', 'example', 'experience',
  'eyes', 'face', 'fact', 'fall', 'family', 'far', 'fast', 'father', 'feel', 'feet',
  'few', 'field', 'figure', 'fill', 'final', 'find', 'fine', 'fire', 'first', 'five',
  'floor', 'fly', 'follow', 'food', 'foot', 'for', 'force', 'form', 'found', 'four',
  'free', 'friend', 'from', 'front', 'full', 'game', 'gave', 'get', 'girl', 'give',
  'glass', 'go', 'going', 'gold', 'gone', 'good', 'got', 'govern', 'great', 'green',
  'ground', 'group', 'grow', 'half', 'hand', 'happen', 'hard', 'have', 'he', 'head',
  'hear', 'heard', 'heart', 'heat', 'heavy', 'help', 'her', 'here', 'high', 'him',
  'his', 'hold', 'home', 'horse', 'hot', 'hour', 'house', 'how', 'however', 'human',
  'hundred', 'idea', 'if', 'important', 'in', 'inch', 'include', 'inside', 'instead', 'interest',
  'into', 'island', 'it', 'its', 'just', 'keep', 'kind', 'king', 'knew', 'know',
  'known', 'land', 'language', 'large', 'last', 'later', 'laugh', 'lay', 'lead', 'learn',
  'least', 'leave', 'left', 'less', 'letter', 'life', 'light', 'like', 'line', 'list',
  'listen', 'little', 'live', 'long', 'look', 'love', 'machine', 'made', 'make', 'many',
  'map', 'mark', 'matter', 'me', 'mean', 'measure', 'might', 'mile', 'mind', 'minute',
  'miss', 'money', 'month', 'moon', 'more', 'morning', 'most', 'mother', 'mountain', 'move',
  'much', 'multiply', 'music', 'must', 'my', 'name', 'near', 'need', 'never', 'new',
  'next', 'night', 'no', 'north', 'not', 'note', 'nothing', 'notice', 'noun', 'now',
  'number', 'object', 'ocean', 'of', 'often', 'oh', 'old', 'on', 'once', 'one',
  'only', 'open', 'or', 'order', 'other', 'our', 'out', 'outside', 'over', 'own',
  'page', 'paint', 'paper', 'part', 'pass', 'past', 'pattern', 'people', 'perhaps', 'period',
  'person', 'picture', 'piece', 'place', 'plain', 'plan', 'plane', 'plant', 'play', 'point',
  'pose', 'possible', 'pound', 'power', 'problem', 'produce', 'product', 'pull', 'put', 'question',
  'quick', 'rain', 'ran', 'reach', 'read', 'ready', 'really', 'record', 'red', 'remember',
  'rest', 'right', 'river', 'road', 'rock', 'room', 'round', 'rule', 'run', 'said',
  'same', 'saw', 'say', 'school', 'second', 'section', 'see', 'seem', 'seen', 'serve',
  'set', 'several', 'shape', 'she', 'ship', 'short', 'should', 'show', 'side', 'simple',
  'since', 'sing', 'six', 'slow', 'small', 'snow', 'so', 'some', 'something', 'song',
  'soon', 'south', 'space', 'special', 'spell', 'stand', 'star', 'start', 'state', 'stay',
  'stead', 'step', 'still', 'stood', 'stop', 'story', 'street', 'strong', 'study', 'such',
  'surface', 'system', 'table', 'tail', 'take', 'talk', 'teach', 'tell', 'ten', 'test',
  'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'think', 'this', 'those', 'though', 'thought', 'thousand', 'three', 'through', 'time', 'tire',
  'to', 'together', 'told', 'took', 'top', 'toward', 'town', 'travel', 'tree', 'true',
  'try', 'turn', 'two', 'under', 'understand', 'unit', 'until', 'up', 'upon', 'us',
  'use', 'used', 'using', 'usual', 'verb', 'very', 'voice', 'vowel', 'wait', 'walk',
  'want', 'war', 'warm', 'watch', 'water', 'way', 'we', 'week', 'weight', 'well',
  'went', 'were', 'west', 'what', 'wheel', 'when', 'where', 'which', 'while', 'white',
  'who', 'whole', 'will', 'wind', 'with', 'within', 'without', 'woman', 'wonder', 'word',
  'work', 'world', 'would', 'write', 'year', 'yes', 'you', 'young', 'your',
];

export function extractBigrams(word) {
  const bigrams = [];
  for (let i = 0; i < word.length - 1; i++) {
    bigrams.push(word[i] + word[i + 1]);
  }
  return bigrams;
}

export function scoreWord(word, weakBigrams, worstBigram) {
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

export function generateDrill(weakBigrams, reps = 5) {
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
export function shuffle(items) {
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

// Pure: the caller fetches the user's bigram stats and passes them in, so this
// module has no database dependency and can be tested with a plain object.
export function generatePractice({ stats, count = 10, wordCount = 35 }) {
  const allBigrams = stats?.bigrams || [];
  const totalSessions = stats?.total_sessions || 0;

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