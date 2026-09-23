import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../context/AuthContext';
// Duplicated from backend/practice.js on purpose — Railway builds each service
// from its own directory, so a module at the repo root would not be in this
// build context. Keep the two copies identical; `node scripts/check-word-bank.mjs`
// fails if they drift apart.
const WORD_BANK = [
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

// How many words to pick per test
const WORDS_PER_TEST = 40;
const WORD_COUNT_OPTIONS = [10, 25, 40, 60, 100];

// Fisher-Yates. Array.sort(() => 0.5 - Math.random()) is biased and produces an
// uneven distribution, so a few words would appear far more often than others.
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick N random words from the bank
function pickWords(count) {
  return shuffle(WORD_BANK).slice(0, count);
}

// Drill text is bigrams joined by DOUBLE spaces, with single spaces separating
// tokens. Mirrors the format written by backend/practice.js.
function splitDrillText(text) {
  return text
    .split('  ')
    .flatMap((group) => group.trim().split(' '))
    .filter(Boolean);
}

export default function TypingTest({
  onViewDashboard,
  mode = 'normal',
  practiceWords = [],
  drillText = '',
  targetedBigrams = [],
  onBackToDashboard,
  onSessionSaved,
  entitlements,
  onEntitlementsChanged,
}) {
  // ─── Refs (don't trigger re-renders on every keystroke) ──────────
  const keystrokesRef = useRef([]);
  const startTimeRef = useRef(null);
  const inputRef = useRef(null);
  const wordStatusesRef = useRef([]);   // mirrors wordStatuses state for sync access in callbacks
  const typedWordsRef = useRef([]);     // stores what user typed per completed word index
  const prevWpmRef = useRef(0);        // tracks previous WPM for pulse detection
  const wordsContainerRef = useRef(null); // ref for measuring word rows
  const restartButtonRef = useRef(null);  // so Tab can jump straight to restart
  const [sealFrame, setSealFrame] = useState(0);

  // ─── Scrolling viewport (3 rows max) ──────────────────────────────
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(null); // null = auto

  // ─── State ────────────────────────────────────────────────────────
  const isPractice = mode === 'practice';
  const { user } = useAuth();
  const navigate = useNavigate();
  // Remaining AI allowance. Null until entitlements load, and null limit means
  // unlimited (premium), so both cases simply hide the badge.
  const aiQuota = entitlements?.usage?.llm_practice ?? null;
  const aiPremium = entitlements?.premium === true;
  const [textMode, setTextMode] = useState('words'); // 'words' | 'quotes'
  const [wordCount, setWordCount] = useState(WORDS_PER_TEST);
  const initialWords = isPractice && practiceWords.length > 0
    ? practiceWords
    : pickWords(wordCount);

  const [words, setWords] = useState(initialWords);
  const [practiceMode, setPracticeMode] = useState('words'); // 'words' | 'drill' | 'ai'
  const [aiWords, setAiWords] = useState(null);   // passage generated this session
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState(null);
  // AI tab selected but nothing generated yet — the words area shows the button.
  const aiNeedsGeneration = isPractice && practiceMode === 'ai' && !aiWords;

  // ─── Fetch quotes from backend ────────────────────────────────────
  const [quoteCount, setQuoteCount] = useState(5);
  const QUOTE_COUNT_OPTIONS = [1, 3, 5, 10];

  const fetchQuotes = useCallback((countOverride) => {
    if (isPractice) return;
    const count = countOverride ?? quoteCount;
    apiFetch(`/api/quotes?count=${count}&category=seal`)
      .then(res => res.json())
      .then(json => {
        const quoteText = json.quotes.map(q => q.text).join(' ');
        setWords(quoteText.split(/\s+/));
      })
      .catch(() => {
        setWords(pickWords(wordCount));
      });
  }, [isPractice, quoteCount, wordCount]);

  // ─── Reset words when mode changes (route switch) ─────────────────
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (mode === prevModeRef.current) return;
    prevModeRef.current = mode;

    if (isPractice && practiceWords.length > 0) {
      setWords(practiceWords);
    } else if (textMode === 'quotes') {
      fetchQuotes();
    } else {
      setWords(pickWords(wordCount));
    }

    // Reset all test state
    keystrokesRef.current = [];
    wordStatusesRef.current = [];
    typedWordsRef.current = [];
    startTimeRef.current = null;
    prevWpmRef.current = 0;
    setCurrentWordIndex(0);
    setUserInput('');
    setTestState('idle');
    setWordStatuses([]);
    setTypedWords([]);
    setLiveWpm(0);
    setWpmPulseKey(0);
    setLiveAccuracy(100);
    setLiveWordAccuracy(100);
    setElapsed(0);
    setResultData(null);
    setCachedStats(null);
    setPostStatus('idle');
    setXpResult(null);
    setPracticeMode('words');
    setAiWords(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState('');          // typed chars for current word
  const [testState, setTestState] = useState('idle');       // 'idle' | 'running' | 'finished'
  const [wordStatuses, setWordStatuses] = useState([]);     // per-word: 'correct' | 'incorrect' | null
  const [typedWords, setTypedWords] = useState([]);         // per-word: what user actually typed
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [liveWordAccuracy, setLiveWordAccuracy] = useState(100);
  const [elapsed, setElapsed] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [postStatus, setPostStatus] = useState('idle');     // 'idle' | 'posting' | 'error' | 'done'
  const [cachedStats, setCachedStats] = useState(null);     // snapshot stats on finish
  const [xpResult, setXpResult] = useState(null);           // XP awarded by the last saved session
  const [wpmPulseKey, setWpmPulseKey] = useState(0);       // increments on WPM change to trigger pulse animation

  // ─── Computed ─────────────────────────────────────────────────────
  const currentWord = words[currentWordIndex] || '';

  // ─── Auto-focus hidden input on mount & after restart ────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, [testState]);

  // ─── Initial quotes fetch on mount ───────────────────────────────
  useEffect(() => {
    if (textMode === 'quotes' && !isPractice && words.length === 0) {
      fetchQuotes();
    }
  }, []);

  // ─── Scrolling 3-row viewport ────────────────────────────────────
  useLayoutEffect(() => {
    const container = wordsContainerRef.current;
    if (!container) return;

    // Measure immediately after layout
    const children = container.querySelectorAll(':scope > span');
    if (children.length === 0) return;

    // Group words by their vertical position (offsetTop)
    const rowTops = [];
    const rowIndices = []; // start index of each row
    let lastTop = -1;
    for (let i = 0; i < children.length; i++) {
      const top = children[i].offsetTop;
      if (top !== lastTop) {
        rowTops.push(top);
        rowIndices.push(i);
        lastTop = top;
      }
    }

    // Calculate row height from first two rows (or estimate from first child)
    const rowHeight = rowTops.length >= 2
      ? rowTops[1] - rowTops[0]
      : children[0].offsetHeight + 8; // gap-y-2 ≈ 8px

    if (rowHeight <= 0) return;

    // Find which row the current word is on
    let activeRow = 0;
    for (let r = rowIndices.length - 1; r >= 0; r--) {
      if (currentWordIndex >= rowIndices[r]) {
        activeRow = r;
        break;
      }
    }

    // If the active row is beyond the 3rd visible row, shift up
    // Show activeRow at the bottom (3rd position), so offset = (activeRow - 2) rows
    const offset = Math.max(0, activeRow - 1) * rowHeight;
    setScrollOffset(offset);
    setViewportHeight(3 * rowHeight);
  }, [words, currentWordIndex, testState]);

  // ─── Live WPM / timer ticker ─────────────────────────────────────
  useEffect(() => {
    if (testState !== 'running') return;

    const interval = setInterval(() => {
      if (!startTimeRef.current) return;

      const now = Date.now();
      const elapsedMs = now - startTimeRef.current;
      setElapsed(Math.floor(elapsedMs / 1000));

      // Calculate WPM: (total correct characters / 5) / minutes
      const correctChars = keystrokesRef.current
        .filter(k => k.correct && k.key !== ' ' && k.key !== 'Backspace')
        .length;

      const minutes = elapsedMs / 60000;
      const wpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
      setLiveWpm(wpm);
      if (wpm !== prevWpmRef.current) {
        prevWpmRef.current = wpm;
        setWpmPulseKey(k => k + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [testState]);

  // ─── Finish the test ──────────────────────────────────────────────
  const finishTest = useCallback(() => {
    setTestState('finished');

    const endTime = Date.now();
    const durationSec = startTimeRef.current
      ? (endTime - startTimeRef.current) / 1000
      : 0;

    const keystrokes = keystrokesRef.current;

    // Count correct characters (excluding space and backspace)
    const correctChars = keystrokes.filter(k => k.correct && k.key !== ' ' && k.key !== 'Backspace').length;

    // Total non-space, non-backspace keystrokes
    const totalTypingKeystrokes = keystrokes.filter(k => k.key !== ' ' && k.key !== 'Backspace').length;

    // Total non-backspace keystrokes used for word accuracy
    const totalNonBackspace = keystrokes.filter(k => k.key !== 'Backspace').length;

    const wpm = durationSec > 0 ? Math.round((correctChars / 5) / (durationSec / 60) * 10) / 10 : 0;
    const accuracy = totalTypingKeystrokes > 0
      ? Math.round((correctChars / totalTypingKeystrokes) * 1000) / 10
      : 100;

    const totalWords = words.length;
    const correctWords = wordStatusesRef.current.filter(s => s === 'correct').length;
    const wordAccuracy = totalWords > 0
      ? Math.round((correctWords / totalWords) * 1000) / 10
      : 100;

    const result = {
      wpm,
      accuracy,
      wordAccuracy,
      durationSec,
      totalKeystrokes: totalNonBackspace,
      totalWords,
      correctWords,
      keystrokes,
      words,
    };

    setResultData(result);
    setCachedStats({ wpm, accuracy, wordAccuracy, correctWords, totalWords, durationSec, totalKeystrokes: totalNonBackspace });

    // ─── POST to backend ──────────────────────────────────────────
    // Guests have no account to attach a session to, so their results are
    // displayed but never persisted.
    if (!user) {
      setPostStatus('guest');
      return;
    }

    setPostStatus('posting');
    const payload = {
      started_at: new Date(startTimeRef.current).toISOString(),
      wpm,
      accuracy,
      word_accuracy: wordAccuracy,
      duration_seconds: Math.round(durationSec * 10) / 10,
      total_keystrokes: totalNonBackspace,
      total_words: totalWords,
      correct_words: correctWords,
      word_list: words,
      keystrokes,
      // The server multiplies by 2 for practice; sending the mode is what makes
      // the bonus apply and is what the session row records.
      mode: isPractice ? 'practice' : 'normal',
    };

    apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error('Server error');
        return res.json().catch(() => null);
      })
      .then(json => {
        setPostStatus('done');
        if (json && typeof json.xp_earned === 'number') setXpResult(json);
        // A saved session changes bigram stats — let the layout re-check
        // whether practice should now be unlocked, and refresh the level badge.
        onSessionSaved?.();
      })
      .catch(() => {
        setPostStatus('error');
      });
  }, [words, user, onSessionSaved, isPractice]);

  // ─── Advance to next word ─────────────────────────────────────────
  // Called when user presses Space on a non-empty input
  const advanceWord = useCallback(() => {
    if (userInput.length === 0) return; // don't advance on empty input

    // Record whether this word was fully correct
    const wasCorrect = userInput === currentWord;

    // Save what the user typed for this word
    setTypedWords(prev => {
      const next = [...prev];
      next[currentWordIndex] = userInput;
      typedWordsRef.current = next;
      return next;
    });

    // Update word statuses (both state + ref for sync access)
    const newStatus = wasCorrect ? 'correct' : 'incorrect';
    setWordStatuses(prev => {
      const next = [...prev];
      next[currentWordIndex] = newStatus;
      wordStatusesRef.current = next;  // sync ref immediately
      return next;
    });

    // Check if this was the last word
    if (currentWordIndex >= words.length - 1) {
      // Final word — finish the test
      finishTest();
      return;
    }

    // Advance
    setCurrentWordIndex(prev => prev + 1);
    setUserInput('');
  }, [userInput, currentWord, currentWordIndex, words.length, finishTest]);

  // ─── Calculate character accuracy live ───────────────────────────
  const updateLiveStats = useCallback(() => {
    const ks = keystrokesRef.current;
    const correctChars = ks.filter(k => k.correct && k.key !== ' ' && k.key !== 'Backspace').length;
    const totalTyped = ks.filter(k => k.key !== ' ' && k.key !== 'Backspace').length;
    const charAcc = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 100;
    setLiveAccuracy(charAcc);

    // Use the ref for synchronous word accuracy
    const statuses = wordStatusesRef.current;
    const doneWords = statuses.filter(s => s === 'correct' || s === 'incorrect').length;
    const correctDone = statuses.filter(s => s === 'correct').length;
    const wordAcc = doneWords > 0 ? Math.round((correctDone / doneWords) * 100) : 100;
    setLiveWordAccuracy(wordAcc);
  }, []);

  // ─── KEYDOWN handler — processes character immediately ──────────
  const handleKeyDown = useCallback((e) => {
    if (testState === 'finished') return;

    // Tab jumps straight to the restart button (MonkeyType style). Handled
    // explicitly rather than by DOM order, because the button sits beside the
    // mode toggles — which would otherwise be the first thing Tab reached.
    if (e.key === 'Tab' && !e.shiftKey && restartButtonRef.current) {
      e.preventDefault();
      restartButtonRef.current.focus();
      return;
    }

    // Modifier / navigation keys must never start the test. Starting it on
    // these would hide the word-count selector and kick off the timer.
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

    // Anything that isn't a single character or Backspace (arrows, F-keys,
    // Dead keys) is ignored before the timer starts too.
    if (e.key !== 'Backspace' && e.key.length !== 1) return;

    // First real keystroke starts the timer
    if (testState === 'idle') {
      startTimeRef.current = Date.now();
      setTestState('running');
    }

    setSealFrame(prev => (prev === 0 ? 1 : 0));

    const pressTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const seq = keystrokesRef.current.length;
    const wordIdx = currentWordIndex;

    // ─── SPACE key — submit current word ──────────────────────────
    if (e.key === ' ') {
      e.preventDefault();

      if (userInput.length === 0) {
        // Don't record empty space presses
        return;
      }

      const wasCorrect = userInput === currentWord;

      keystrokesRef.current.push({
        sequence: seq,
        key: ' ',
        intended: ' ',
        correct: wasCorrect,
        pressed_at_ms: pressTime,
        released_at_ms: pressTime, // will be updated on keyup
        word: currentWord,
        word_index: wordIdx,
        position_in_word: userInput.length,
      });

      advanceWord();
      updateLiveStats();
      return;
    }

    // ─── BACKSPACE key — delete last character ────────────────────
    if (e.key === 'Backspace') {
      e.preventDefault();

      if (userInput.length === 0) {
        // ── Go back to previous word if it was incorrect ─────────
        const prevIdx = currentWordIndex - 1;
        if (
          prevIdx >= 0 &&
          wordStatusesRef.current[prevIdx] === 'incorrect'
        ) {
          const prevTyped = typedWordsRef.current[prevIdx] || '';

          // Record the go-back keystroke
          keystrokesRef.current.push({
            sequence: seq,
            key: 'Backspace',
            intended: 'Backspace',
            correct: false,
            pressed_at_ms: pressTime,
            released_at_ms: pressTime,
            word: words[prevIdx],
            word_index: prevIdx,
            position_in_word: prevTyped.length,
          });

          // Clear the incorrect status and typed record for that word,
          // then jump back to it with the previously typed text
          setWordStatuses(prev => {
            const next = [...prev];
            next[prevIdx] = null;
            wordStatusesRef.current = next;
            return next;
          });
          setTypedWords(prev => {
            const next = [...prev];
            next[prevIdx] = undefined;
            typedWordsRef.current = next;
            return next;
          });
          setCurrentWordIndex(prevIdx);
          setUserInput(prevTyped);
          updateLiveStats();
          return;
        }

        // Otherwise, can't go any further back
        return;
      }

      const expectedChar = currentWord[userInput.length - 1];

      keystrokesRef.current.push({
        sequence: seq,
        key: 'Backspace',
        intended: expectedChar || e.key,
        correct: false,
        pressed_at_ms: pressTime,
        released_at_ms: pressTime, // will be updated on keyup
        word: currentWord,
        word_index: wordIdx,
        position_in_word: userInput.length - 1,
      });

      setUserInput(prev => prev.slice(0, -1));
      return;
    }

    // ─── Regular character ──────────────────────────────────────────
    // Only process single characters (length === 1), ignore things like "Dead"
    if (e.key.length !== 1) return;
    e.preventDefault();

    const pos = userInput.length;
    const intended = currentWord[pos] || e.key;
    const correct = e.key === intended;

    keystrokesRef.current.push({
      sequence: seq,
      key: e.key,
      intended: intended,
      correct: correct,
      pressed_at_ms: pressTime,
      released_at_ms: pressTime, // will be updated on keyup
      word: currentWord,
      word_index: wordIdx,
      position_in_word: pos,
    });

    setUserInput(prev => prev + e.key);

    // Auto-finish: last character of the last word ends the test
    const isLastWord = currentWordIndex >= words.length - 1;
    const completedWord = userInput.length + 1 >= currentWord.length;
    if (isLastWord && completedWord) {
      // Did the user type the entire word correctly?
      const finalTyped = userInput + e.key;
      const wordWasCorrect = finalTyped === currentWord;

      // Save typed word
      setTypedWords(prev => {
        const next = [...prev];
        next[currentWordIndex] = finalTyped;
        typedWordsRef.current = next;
        return next;
      });

      setWordStatuses(prev => {
        const next = [...prev];
        next[currentWordIndex] = wordWasCorrect ? 'correct' : 'incorrect';
        wordStatusesRef.current = next;
        return next;
      });
      finishTest();
    }
  }, [testState, currentWordIndex, currentWord, userInput, words, advanceWord, updateLiveStats, words.length, finishTest]);

  // ─── KEYUP handler — updates released_at_ms on last keystroke ────
  const handleKeyUp = useCallback((e) => {
    if (testState === 'finished') return;

    // Ignore modifier-only keypresses
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

    const releaseTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

    // Update the released_at_ms of the last recorded keystroke
    const ks = keystrokesRef.current;
    if (ks.length > 0) {
      ks[ks.length - 1].released_at_ms = releaseTime;
    }
  }, [testState]);

  // ─── Restart test ─────────────────────────────────────────────────
  const restartTest = useCallback(() => {
    keystrokesRef.current = [];
    wordStatusesRef.current = [];
    typedWordsRef.current = [];
    startTimeRef.current = null;
    prevWpmRef.current = 0;
    // Re-pick words for the CURRENT mode. An AI passage has already been paid
    // for, so restarting reuses it rather than generating a new one, and the
    // mode is preserved instead of dropping back to Words.
    if (isPractice && practiceMode === 'ai' && aiWords) {
      setWords(aiWords);
    } else if (isPractice && practiceMode === 'drill' && drillText) {
      setWords(splitDrillText(drillText));
    } else if (isPractice && practiceWords.length > 0) {
      setWords(practiceWords);
    } else if (textMode === 'quotes') {
      fetchQuotes();
    } else {
      setWords(pickWords(wordCount));
    }
    setCurrentWordIndex(0);
    setUserInput('');
    setTestState('idle');
    setWordStatuses([]);
    setTypedWords([]);
    setLiveWpm(0);
    setWpmPulseKey(0);
    setLiveAccuracy(100);
    setLiveWordAccuracy(100);
    setElapsed(0);
    setResultData(null);
    setCachedStats(null);
    setPostStatus('idle');
    setXpResult(null);
    setSealFrame(0);
    // Hand focus back to the test so typing resumes immediately — if restart
    // was triggered from the keyboard, the button still holds focus.
    inputRef.current?.focus();
  }, [isPractice, practiceMode, aiWords, drillText, practiceWords, wordCount, textMode, fetchQuotes]);

  // ─── Switch between words / quotes text mode ─────────────────────
  const handleTextModeChange = useCallback((newMode) => {
    if (newMode === textMode || isPractice) return;
    setTextMode(newMode);
    // Reset everything for the new mode
    keystrokesRef.current = [];
    wordStatusesRef.current = [];
    typedWordsRef.current = [];
    startTimeRef.current = null;
    prevWpmRef.current = 0;
    setCurrentWordIndex(0);
    setUserInput('');
    setTestState('idle');
    setWordStatuses([]);
    setTypedWords([]);
    setLiveWpm(0);
    setWpmPulseKey(0);
    setLiveAccuracy(100);
    setLiveWordAccuracy(100);
    setElapsed(0);
    setResultData(null);
    setCachedStats(null);
    setPostStatus('idle');
    setXpResult(null);
    if (newMode === 'quotes') {
      fetchQuotes();
    } else {
      setWords(pickWords(wordCount));
    }
  }, [textMode, isPractice, fetchQuotes, wordCount]);

  // ─── Practice mode: Words / Drills / AI ────────────────────────────
  // Extracted so all three modes share one reset path. The AI branch awaits a
  // request, so it cannot live inside a state updater.
  const resetTestState = useCallback(() => {
    keystrokesRef.current = [];
    wordStatusesRef.current = [];
    typedWordsRef.current = [];
    startTimeRef.current = null;
    prevWpmRef.current = 0;
    setCurrentWordIndex(0);
    setUserInput('');
    setTestState('idle');
    setWordStatuses([]);
    setTypedWords([]);
    setLiveWpm(0);
    setWpmPulseKey(0);
    setLiveAccuracy(100);
    setLiveWordAccuracy(100);
    setElapsed(0);
    setResultData(null);
    setCachedStats(null);
    setPostStatus('idle');
    setXpResult(null);
  }, []);

  // Switching tabs only chooses a mode — it never spends quota. Generation is a
  // separate, explicit action: the button in the words area.
  const selectPracticeMode = useCallback((next) => {
    if (!isPractice || aiLoading) return;
    if (next === practiceMode) return;

    setAiNotice(null);
    setPracticeMode(next);
    setWords(
      next === 'drill'
        ? splitDrillText(drillText)
        : next === 'ai'
          ? (aiWords ?? [])
          : practiceWords
    );
    resetTestState();
  }, [isPractice, aiLoading, practiceMode, drillText, aiWords, practiceWords, resetTestState]);

  const generateAiPassage = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiNotice(null);

    try {
      const response = await apiFetch('/api/practice/generate-llm', { method: 'POST' });
      const json = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setAiNotice(json.detail || 'You have used today’s AI passages.');
        return;
      }

      if (!response.ok || json.error) {
        setAiNotice('Could not generate a passage just now. Please try again.');
        return;
      }

      // Quota is spent server-side once a passage validates, so refresh the badge.
      onEntitlementsChanged?.();

      if (json.engine !== 'llm' || !json.practice_words?.length) {
        // Never hand back word practice under an AI label. Nothing changed and no
        // quota was used, so say so rather than silently swapping.
        setAiNotice('AI is unavailable right now. Your daily allowance is untouched.');
        return;
      }

      setAiWords(json.practice_words);
      setWords(json.practice_words);
      resetTestState();
    } catch {
      setAiNotice('Could not generate a passage just now. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, resetTestState, onEntitlementsChanged]);

  // ─── Render ───────────────────────────────────────────────────────

  // --- Render a single word ---
  const renderWord = (word, index) => {
    const isActive = index === currentWordIndex;
    const status = wordStatuses[index]; // 'correct' | 'incorrect' | null

    // Completed word
    if (status !== null && status !== undefined && !isActive) {
      // Correct word: simple green rendering
      if (status === 'correct') {
        return (
          <span key={`${index}-correct`} className="text-green-600 opacity-70 px-0.5 inline-block" style={{ animation: 'word-pop 0.35s ease' }}>
            {word}{' '}
          </span>
        );
      }

      // Incorrect word: render character by character with red underline
      const typed = typedWords[index] || word;
      const incorrectChars = [];
      const incorrectMaxLen = Math.max(word.length, typed.length);

      for (let i = 0; i < incorrectMaxLen; i++) {
        if (i < word.length) {
          const isCharCorrect = i < typed.length && typed[i] === word[i];
          incorrectChars.push(
            <span key={i} className={`transition-colors duration-500 ${isCharCorrect ? 'text-green-600' : 'text-red-500'}`}>
              {word[i]}
            </span>
          );
        }
      }

      // Show any extra typed characters beyond word length
      if (typed.length > word.length) {
        for (let i = word.length; i < typed.length; i++) {
          incorrectChars.push(
            <span key={`extra-${i}`} className="text-red-500 opacity-60 transition-colors duration-500">
              {typed[i]}
            </span>
          );
        }
      }

      incorrectChars.push(<span key="space"> </span>);

      return (
        <span key={`${index}-incorrect`} className="px-0.5 opacity-70 underline decoration-red-500 underline-offset-2 inline-block" style={{ animation: 'word-pop 0.35s ease' }}>
          {incorrectChars}
        </span>
      );
    }

    // Future word
    if (!isActive) {
      return (
        <span key={index} className="text-slate-500 px-0.5">
          {word}{' '}
        </span>
      );
    }

    // ─── Active word: render character by character ──────────────
    const chars = [];
    const maxLen = Math.max(word.length, userInput.length);

    for (let i = 0; i < maxLen; i++) {
      // Render cursor before the character at position === userInput.length
      // (but only if we haven't typed past this word's length, otherwise cursor
      //  goes after — handled below)
      if (i === userInput.length && i < word.length) {
        chars.push(
          <span key="cursor" className="relative inline-block w-0 align-baseline">
            <span className="absolute right-0 -top-[0.95em] w-[3px] h-[1.15em] theme-accent cursor-blink rounded-sm shadow-[0_0_6px_rgba(200,150,62,0.6)]" />
          </span>
        );
      }

      if (i < userInput.length) {
        // Already typed this position
        const typed = userInput[i];
        const expected = word[i] || '';
        const isCorrect = typed === expected;

        if (i < word.length) {
          chars.push(
            <span key={i} className={`transition-colors duration-500 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {word[i]}
            </span>
          );
        } else {
          // User typed extra characters beyond word length
          chars.push(
            <span key={i} className="text-red-400 transition-colors duration-500">
              {typed}
            </span>
          );
        }
      } else {
        // Not yet reached
        if (i < word.length) {
          chars.push(
            <span key={i} className="text-slate-400 transition-colors duration-500">{word[i]}</span>
          );
        }
      }
    }

    // Cursor after the last character (word fully typed, or typing beyond)
    if (userInput.length >= maxLen) {
      chars.push(
        <span key="cursor-end" className="relative inline-block w-0 align-baseline">
            <span className="absolute left-0 -top-[0.95em] w-[3px] h-[1.15em] theme-accent cursor-blink rounded-sm shadow-[0_0_6px_rgba(200,150,62,0.6)]" />
        </span>
      );
    }

    // Add trailing space
    chars.push(<span key="space"> </span>);

    return (
      <span
        key={index}
        className="relative theme-panel rounded-sm px-0.5"
      >
        {chars}
      </span>
    );
  };

  // --- Generate prompt, shown INSIDE the words box until a passage exists ---
  // Deliberately has no seal of its own: renderLiveWpm already draws the big one
  // above, and a second smaller seal is what made the layout look like it jumped.
  const renderAiGenerate = () => (
    // No height utilities here: the wrapper above centres this block and grows to
    // fit it. Any `h-full` would resolve against an auto-height parent and do
    // nothing, so its absence is deliberate.
    <div className="flex flex-col items-center justify-center gap-3 py-2">
      {aiLoading ? (
        <p className="theme-text-soft text-sm text-center">
          Writing a passage dense in{' '}
          <span className="theme-text">
            {targetedBigrams.slice(0, 4).map((b) => b.bigram).join(', ')}
          </span>
          …
        </p>
      ) : (
        <>
          <p className="theme-text-soft text-sm text-center max-w-md">
            A short passage written around the letter pairs you miss most
            {targetedBigrams.length > 0 && (
              <> — {targetedBigrams.slice(0, 4).map((b) => b.bigram).join(', ')}</>
            )}
            .
          </p>

          <button
            onClick={generateAiPassage}
            className="font-pixel px-6 py-2 rounded-lg text-sm font-bold transition-colors bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            Generate passage
          </button>

          <p className="text-xs theme-text-subtle">
            {aiQuota && !aiPremium
              ? `Uses one of your ${aiQuota.limit} daily AI passages. ${aiQuota.remaining} left today`
              : 'Nothing is generated until you press the button.'}
          </p>
        </>
      )}
    </div>
  );

  // --- Hint under the mode tabs ---
  const renderModeHint = () => {
    if (!isPractice) return null;

    // Failures are reported here, below the box, and never inside it. The words
    // box is clipped to three rows, so a two-line notice placed in there was cut
    // off mid-sentence — the message disappeared exactly when it mattered most.
    if (aiNotice) {
      return <p className="text-xs text-amber-400/90 max-w-sm text-center">{aiNotice}</p>;
    }

    // While generating, or before a passage exists, the box owns the messaging.
    if (aiLoading || aiNeedsGeneration) return null;

    // Only shown in AI mode — the remaining count is noise while practising with
    // words or drills.
    const showQuota = practiceMode === 'ai' && aiQuota && !aiPremium;
    const canRefresh = practiceMode === 'ai' && aiWords && testState === 'idle';
    if (!showQuota && !canRefresh) return null;

    return (
      <p className="flex items-center gap-3 text-xs theme-text-subtle">
        {showQuota && (
          <span>
            {aiQuota.remaining} of {aiQuota.limit} AI passages left today
          </span>
        )}
        {canRefresh && (
          <button
            onClick={generateAiPassage}
            className="underline underline-offset-2 hover:text-amber-400 transition-colors"
          >
            New passage
          </button>
        )}
      </p>
    );
  };

  // --- Render word rows (wrap words naturally, 3 rows max) ---
  const renderWords = () => {
    // Two different needs share this box. The word grid must stay clipped to
    // exactly three rows so nothing shifts when the mode changes, so it keeps a
    // fixed height. The AI panel is centred prose rather than a grid, so it gets
    // a floor instead of a lid — pinned to that same fixed height it had no room
    // to grow, and anything past the third row was silently cut off.
    const boxHeight = viewportHeight != null ? `${viewportHeight}px` : undefined;
    return (
      <div
        className={`max-w-3xl mx-auto select-none ${
          aiNeedsGeneration ? 'flex items-center justify-center' : 'overflow-hidden'
        }`}
        style={aiNeedsGeneration ? { minHeight: boxHeight } : { height: boxHeight }}
      >
        {aiNeedsGeneration ? (
          renderAiGenerate()
        ) : (
          <div
            ref={wordsContainerRef}
            className="flex flex-wrap gap-x-3 gap-y-2 justify-center text-2xl font-mono leading-relaxed"
            style={{
              transform: `translateY(-${scrollOffset}px)`,
              transition: testState === 'running' ? 'transform 0.3s ease' : 'none',
            }}
          >
            {words.map((word, i) => renderWord(word, i))}
          </div>
        )}
      </div>
    );
  };

  // --- Render progress bar ---
  const renderProgressBar = () => {
    const done = wordStatuses.filter(s => s !== null && s !== undefined).length;
    const pct = words.length > 0 ? Math.round((done / words.length) * 100) : 0;
    return (
      // `invisible` (visibility: hidden), NOT conditional rendering: the element
      // keeps its box, so hiding it before a passage exists cannot reflow the
      // rest of the page. Do not "simplify" this into a ternary.
      <div className={`w-full max-w-xl mx-auto mb-5 ${aiNeedsGeneration ? 'invisible' : ''}`}>
        <div className="h-1.5 theme-panel rounded-none overflow-hidden">
          <div
            className="h-full theme-accent rounded-none transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };


  // --- Render the restart button ---
  // Absolutely positioned just past the toggle row so the toggles themselves
  // keep their centred position on screen.
  const renderRestart = () => (
    <button
      ref={restartButtonRef}
      type="button"
      onClick={restartTest}
      title="Restart test (Tab, then Enter)"
      aria-label="Restart test"
      className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-8 h-8 flex items-center justify-center border border-slate-700 theme-text-muted theme-text-hover transition-colors hover:border-amber-500/60 focus:outline-none focus:border-amber-500 focus:text-amber-400"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    </button>
  );

  // --- Render seal + live WPM side by side ---
  const renderLiveWpm = () => (
    <div className="flex items-center justify-center gap-6 mb-3">
      {/* Animated Typing Seal */}
      {/* Pulsing while a passage generates, so the "working" cue reuses the seal
          that is already here rather than introducing a second, smaller one. */}
      <div className={`relative w-40 h-40 select-none pointer-events-none ${aiLoading ? 'animate-pulse' : ''}`}>
        <img
          src="/sealdown.png"
          alt="Seal typing down"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
            sealFrame === 0 ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <img
          src="/sealup.png"
          alt="Seal typing up"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
            sealFrame === 1 ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* WPM Readout */}
      <div className="flex items-baseline">
        <span
          key={wpmPulseKey}
          className="text-7xl font-bold theme-accent-text inline-block tabular-nums"
          style={{ animation: 'wpm-pulse 0.4s ease' }}
        >
          {liveWpm}
        </span>
        <span className="text-2xl theme-text-subtle font-mono ml-2">WPM</span>
      </div>
    </div>
  );

  // --- Render live stats bar ---
  // Hidden with `invisible` rather than unmounted, for the same reason as the
  // progress bar: the row must keep its height so nothing shifts.
  const renderStatsBar = () => (
    <div
      className={`flex gap-6 justify-center text-sm theme-text-muted font-mono mb-6 ${
        aiNeedsGeneration ? 'invisible' : ''
      }`}
    >
      <span>Acc: <span className="text-amber-400 font-bold">{liveAccuracy}%</span></span>
      <span>Word Acc: <span className="text-amber-400 font-bold">{liveWordAccuracy}%</span></span>
      <span>
        Word <span className="text-amber-400 font-bold">{words.length > 0 ? currentWordIndex + 1 : 0}</span> /{' '}
        {words.length}
      </span>
      <span>{elapsed}s</span>
    </div>
  );

  // --- Render results screen ---
  const renderResults = () => {
    const stats = cachedStats || resultData;
    if (!stats) return null;

    return (
      <div className="flex flex-col items-center gap-6 animate-fadeIn">
        <h2 className="text-3xl font-bold theme-text">Results</h2>

        <div className="text-7xl font-bold theme-accent-text">{stats.wpm}</div>
        <div className="theme-text-muted text-lg -mt-4">WPM</div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-3 theme-text-soft text-lg">
          <div className="text-right theme-text-subtle">Accuracy</div>
          <div>{stats.accuracy}%</div>

          <div className="text-right theme-text-subtle">Word Accuracy</div>
          <div>{stats.wordAccuracy}%</div>

          <div className="text-right theme-text-subtle">Duration</div>
          <div>{Math.round(stats.durationSec * 10) / 10}s</div>

          <div className="text-right theme-text-subtle">Keystrokes</div>
          <div>{stats.totalKeystrokes}</div>

          <div className="text-right theme-text-subtle">Correct Words</div>
          <div>{stats.correctWords} / {stats.totalWords}</div>
        </div>

        {/* XP awarded by the server for this session */}
        {postStatus === 'done' && xpResult && (
          <div className="flex flex-col items-center gap-1">
            <div className="theme-accent-text text-2xl font-bold tabular-nums">
              +{xpResult.xp_earned} XP
            </div>
            {xpResult.leveled_up && (
              <div className="text-green-400 text-sm font-bold">
                Level up! → {xpResult.level}
              </div>
            )}
          </div>
        )}

        {/* POST status */}
        {postStatus === 'posting' && (
          <div className="theme-text-subtle text-sm">Saving results...</div>
        )}
        {postStatus === 'error' && (
          <div className="theme-danger text-sm">⚠ Results not saved — backend unavailable</div>
        )}
        {postStatus === 'guest' && (
          <button
            onClick={() => navigate('/login')}
            className="theme-text-muted hover:theme-text text-sm transition-colors"
          >
            Sign in to save your results and earn XP →
          </button>
        )}


        <div className="flex gap-4 mt-4">
          <button
            onClick={restartTest}
            className="px-6 py-2 theme-accent font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
          {isPractice && onBackToDashboard ? (
            <button
              onClick={onBackToDashboard}
              className="px-6 py-2 theme-success font-bold rounded-lg transition-colors"
            >
              Return to Dashboard
            </button>
          ) : (
            <button
              onClick={onViewDashboard}
              className="px-6 py-2 theme-panel-muted theme-panel-hover theme-text font-bold rounded-lg transition-colors"
            >
              View Dashboard
            </button>
          )}
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <div
      className="flex-1 flex flex-col items-center justify-start pt-8 px-4 pb-4 theme-app"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input to capture keystrokes */}
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        readOnly
        value=""
        onChange={() => {}} // keep React happy with readOnly
      />

      {testState !== 'finished' && (
        <>
          {renderLiveWpm()}
          {renderProgressBar()}
          {renderWords()}
          {renderStatsBar()}

          {/* Mode + count selectors — bottom, not in practice mode */}
          {!isPractice && (
            <div className="flex flex-col items-center gap-3 mt-6">
              {/* Text mode toggle (matches practice Words/Drills styling) */}
              <div className="relative flex gap-2">
                <button
                  onClick={() => handleTextModeChange('words')}
                  className={`font-pixel px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    textMode === 'words'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Words
                </button>
                <button
                  onClick={() => handleTextModeChange('quotes')}
                  className={`font-pixel px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    textMode === 'quotes'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Quotes
                </button>
                {renderRestart()}
              </div>

              {/* Word / quote count — idle only */}
              {testState === 'idle' && (
                <div className="flex items-center gap-2">
                  {(textMode === 'quotes' ? QUOTE_COUNT_OPTIONS : WORD_COUNT_OPTIONS).map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        if (textMode === 'quotes') {
                          setQuoteCount(n);
                          fetchQuotes(n);
                        } else {
                          setWordCount(n);
                          setWords(pickWords(n));
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-colors ${
                        (textMode === 'quotes' ? quoteCount === n : wordCount === n)
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Practice mode — Words / Drills / AI */}
          {isPractice && (
            <div className="flex flex-col items-center gap-2 mt-6">
              <div className="relative flex gap-2">
                <button
                  onClick={() => selectPracticeMode('words')}
                  disabled={aiLoading}
                  className={`font-pixel px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                    practiceMode === 'words'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Words
                </button>
                {drillText && (
                  <button
                    onClick={() => selectPracticeMode('drill')}
                    disabled={aiLoading}
                    className={`font-pixel px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                      practiceMode === 'drill'
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    Drills
                  </button>
                )}
                <button
                  onClick={() => selectPracticeMode('ai')}
                  disabled={aiLoading}
                  title="A passage written for your own weak letter pairs"
                  className={`font-pixel px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-70 ${
                    practiceMode === 'ai'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {aiLoading ? 'AI…' : 'AI'}
                </button>
                {renderRestart()}
              </div>

              {renderModeHint()}
            </div>
          )}
        </>
      )}

      {testState === 'finished' && renderResults()}
    </div>
  );
}
