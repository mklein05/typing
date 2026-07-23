import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import PracticeBanner from './PracticeBanner';

// ─── WORD LIST (200+ common English words) ────────────────────────────
const WORD_BANK = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "great",
  "between", "need", "large", "often", "hand", "high", "place", "small", "house", "long",
  "while", "might", "world", "three", "still", "every", "found", "those", "under", "last",
  "never", "same", "another", "much", "right", "old", "little", "before", "line", "own",
  "very", "keep", "eyes", "once", "ask", "put", "went", "does", "done", "head",
  "life", "each", "tell", "always", "set", "help", "here", "far", "both", "end",
  "left", "run", "home", "read", "big", "move", "try", "kind", "hand", "again",
  "change", "play", "spell", "air", "away", "animal", "point", "page", "letter", "mother",
  "answer", "found", "study", "still", "learn", "should", "world", "high", "near", "add",
  "food", "own", "below", "country", "plant", "last", "school", "father", "keep", "tree",
  "never", "start", "city", "earth", "light", "thought", "head", "under", "story", "saw",
  "left", "few", "while", "along", "next", "hard", "open", "seem", "next", "white",
  "children", "begin", "got", "walk", "example", "ease", "paper", "group", "music", "those",
  "both", "mark", "book", "letter", "until", "mile", "river", "car", "feet", "care",
  "second", "enough", "plain", "girl", "usual", "young", "ready", "above", "ever", "red",
  "list", "though", "feel", "talk", "bird", "soon", "body", "dog", "family", "direct",
  "pose", "leave", "song", "measure", "door", "product", "black", "short", "number", "class",
  "wind", "question", "happen", "complete", "ship", "area", "half", "rock", "order", "fire",
  "south", "problem", "piece", "told", "knew", "pass", "since", "top", "whole", "king",
  "space", "heard", "best", "hour", "better", "true", "during", "hundred", "five", "remember",
  "step", "early", "hold", "west", "ground", "interest", "reach", "fast", "verb", "sing",
  "listen", "six", "table", "travel", "less", "morning", "ten", "simple", "several", "vowel",
  "toward", "war", "lay", "pattern", "slow", "center", "love", "person", "money", "serve",
  "appear", "road", "map", "rain", "rule", "govern", "pull", "cold", "notice", "voice",
  "unit", "power", "town", "fine", "certain", "fly", "fall", "lead", "cry", "dark",
  "machine", "note", "wait", "plan", "figure", "star", "box", "noun", "field", "rest",
  "correct", "able", "pound", "done", "beauty", "drive", "stood", "contain", "front", "teach",
  "week", "final", "gave", "green", "oh", "quick", "develop", "ocean", "warm", "free",
  "minute", "strong", "special", "mind", "behind", "clear", "tail", "produce", "fact", "street",
  "inch", "multiply", "nothing", "course", "stay", "wheel", "full", "force", "blue", "object",
  "decide", "surface", "deep", "moon", "island", "foot", "system", "busy", "test", "record",
  "boat", "common", "gold", "possible", "plane", "stead", "dry", "wonder", "laugh", "thousand",
  "ago", "ran", "check", "game", "shape", "equate", "hot", "miss", "brought", "heat",
  "snow", "tire", "bring", "yes", "distant", "fill", "east", "paint", "language", "among",
];

// How many words to pick per test
const WORDS_PER_TEST = 40;
const WORD_COUNT_OPTIONS = [10, 25, 40, 60, 100];

// Pick N random words from the bank
function pickWords(count) {
  const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function TypingTest({
  onViewDashboard,
  mode = 'normal',
  practiceWords = [],
  drillText = '',
  targetedBigrams = [],
  onBackToDashboard,
}) {
  // ─── Refs (don't trigger re-renders on every keystroke) ──────────
  const keystrokesRef = useRef([]);
  const startTimeRef = useRef(null);
  const inputRef = useRef(null);
  const wordStatusesRef = useRef([]);   // mirrors wordStatuses state for sync access in callbacks
  const typedWordsRef = useRef([]);     // stores what user typed per completed word index
  const prevWpmRef = useRef(0);        // tracks previous WPM for pulse detection
  const wordsContainerRef = useRef(null); // ref for measuring word rows

  // ─── Scrolling viewport (3 rows max) ──────────────────────────────
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(null); // null = auto

  // ─── State ────────────────────────────────────────────────────────
  const isPractice = mode === 'practice';
  const [wordCount, setWordCount] = useState(WORDS_PER_TEST);
  const initialWords = isPractice && practiceWords.length > 0
    ? practiceWords
    : pickWords(wordCount);

  const [words, setWords] = useState(initialWords);
  const [drillMode, setDrillMode] = useState(false);   // drill sub-mode toggle
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
  const [wpmPulseKey, setWpmPulseKey] = useState(0);       // increments on WPM change to trigger pulse animation

  // ─── Computed ─────────────────────────────────────────────────────
  const currentWord = words[currentWordIndex] || '';

  // ─── Auto-focus hidden input on mount & after restart ────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, [testState]);

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

    // ─── Debug: log collected keystroke data ─────────────────────
    console.log("keystrokes:", keystrokes);
    console.log("total keystrokes:", keystrokes.length);
    console.log("sample:", JSON.stringify(keystrokes.slice(0, 5), null, 2));

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
    };

    fetch('http://localhost:8000/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error('Server error');
        setPostStatus('done');
      })
      .catch(() => {
        setPostStatus('error');
      });
  }, [words]);

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
    // Start timer on first keydown
    if (testState === 'idle') {
      startTimeRef.current = Date.now();
      setTestState('running');
    }

    if (testState === 'finished') return;

    // Ignore modifier-only keypresses
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

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
        // Cannot backspace into previous word
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
  }, [testState, currentWordIndex, currentWord, userInput, advanceWord, updateLiveStats, words.length, finishTest]);

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
    setWords(isPractice && practiceWords.length > 0 ? practiceWords : pickWords(wordCount));
    setDrillMode(false);
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
  }, [isPractice, practiceWords, wordCount]);

  // ─── Toggle drill mode (practice only) ────────────────────────────
  const toggleDrillMode = useCallback(() => {
    if (!isPractice) return;
    setDrillMode(prev => {
      const next = !prev;
      // Swap words: drill words or practice words
      if (next && drillText) {
        // Split drill text by double-space, then by single space
        const drillWords = drillText.split('  ').flatMap(group => group.trim().split(' ')).filter(Boolean);
        setWords(drillWords);
      } else {
        setWords(practiceWords);
      }
      // Reset test state
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
      return next;
    });
  }, [isPractice, drillText, practiceWords]);

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
            <span className="absolute right-0 -top-[0.95em] w-[3px] h-[1.15em] bg-yellow-400 cursor-blink rounded-sm shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
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
          <span className="absolute left-0 -top-[0.95em] w-[3px] h-[1.15em] bg-yellow-400 cursor-blink rounded-sm shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
        </span>
      );
    }

    // Add trailing space
    chars.push(<span key="space"> </span>);

    return (
      <span
        key={index}
        className="relative bg-slate-800/50 rounded-sm px-0.5"
      >
        {chars}
      </span>
    );
  };

  // --- Render word rows (wrap words naturally, 3 rows max) ---
  const renderWords = () => (
    <div
      className="overflow-hidden max-w-3xl mx-auto select-none"
      style={{ height: viewportHeight != null ? `${viewportHeight}px` : 'auto' }}
    >
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
    </div>
  );

  // --- Render progress bar ---
  const renderProgressBar = () => {
    const done = wordStatuses.filter(s => s !== null && s !== undefined).length;
    const pct = words.length > 0 ? Math.round((done / words.length) * 100) : 0;
    return (
      <div className="w-full max-w-xl mx-auto mb-5">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  // --- Render live WPM (big, above stats) ---
  const renderLiveWpm = () => (
    <div className="flex justify-center mb-3">
      <span
        key={wpmPulseKey}
        className="text-7xl font-bold text-yellow-400 inline-block tabular-nums"
        style={{ animation: 'wpm-pulse 0.4s ease' }}
      >
        {liveWpm}
      </span>
      <span className="text-2xl text-slate-500 font-mono self-end mb-2 ml-1">WPM</span>
    </div>
  );

  // --- Render live stats bar ---
  const renderStatsBar = () => (
    <div className="flex gap-6 justify-center text-sm text-slate-400 font-mono mb-6">
      <span>Acc: <span className="text-yellow-400 font-bold">{liveAccuracy}%</span></span>
      <span>Word Acc: <span className="text-yellow-400 font-bold">{liveWordAccuracy}%</span></span>
      <span>Word <span className="text-yellow-400 font-bold">{currentWordIndex + 1}</span> / {words.length}</span>
      <span>{elapsed}s</span>
    </div>
  );

  // --- Render results screen ---
  const renderResults = () => {
    const stats = cachedStats || resultData;
    if (!stats) return null;

    return (
      <div className="flex flex-col items-center gap-6 animate-fadeIn">
        <h2 className="text-3xl font-bold text-slate-200">Results</h2>

        <div className="text-7xl font-bold text-yellow-400">{stats.wpm}</div>
        <div className="text-slate-400 text-lg -mt-4">WPM</div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-slate-300 text-lg">
          <div className="text-right text-slate-500">Accuracy</div>
          <div>{stats.accuracy}%</div>

          <div className="text-right text-slate-500">Word Accuracy</div>
          <div>{stats.wordAccuracy}%</div>

          <div className="text-right text-slate-500">Duration</div>
          <div>{Math.round(stats.durationSec * 10) / 10}s</div>

          <div className="text-right text-slate-500">Keystrokes</div>
          <div>{stats.totalKeystrokes}</div>

          <div className="text-right text-slate-500">Correct Words</div>
          <div>{stats.correctWords} / {stats.totalWords}</div>
        </div>

        {/* POST status */}
        {postStatus === 'posting' && (
          <div className="text-slate-500 text-sm">Saving results...</div>
        )}
        {postStatus === 'error' && (
          <div className="text-yellow-500 text-sm">⚠ Results not saved — backend unavailable</div>
        )}
        {postStatus === 'done' && (
          <div className="text-green-500 text-sm">✓ Results saved</div>
        )}

        {/* Practice-specific messaging */}
        {isPractice && (
          <p className="text-slate-400 text-sm max-w-md text-center">
            Practice complete! Return to Dashboard to see if your bigram stats improved.
          </p>
        )}

        <div className="flex gap-4 mt-4">
          <button
            onClick={restartTest}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
          {isPractice && onBackToDashboard ? (
            <button
              onClick={onBackToDashboard}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Return to Dashboard
            </button>
          ) : (
            <button
              onClick={onViewDashboard || (() => alert('Dashboard coming soon'))}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg transition-colors"
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
      className="flex-1 flex flex-col items-center justify-start pt-12 px-4 pb-4"
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

      {/* Practice banner */}
      {isPractice && testState !== 'finished' && (
        <PracticeBanner targetedBigrams={targetedBigrams} />
      )}

      {/* Drill mode toggle */}
      {isPractice && drillText && testState !== 'finished' && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => drillMode && toggleDrillMode()}
            className={`px-4 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors ${
              !drillMode
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Words
          </button>
          <button
            onClick={() => !drillMode && toggleDrillMode()}
            className={`px-4 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors ${
              drillMode
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            Drills
          </button>
        </div>
      )}

      {testState !== 'finished' && (
        <>
          {renderLiveWpm()}
          {renderStatsBar()}
          {renderProgressBar()}
          {renderWords()}
          <p className={`text-slate-500 mt-8 text-sm ${testState === 'idle' ? '' : 'invisible'}`}>
            Start typing to begin the test...
          </p>

          {/* Word count selector — idle state only, not in practice mode */}
          {testState === 'idle' && !isPractice && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-slate-500 text-xs font-mono">Words:</span>
              {WORD_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setWordCount(n);
                    setWords(pickWords(n));
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-colors ${
                    wordCount === n
                      ? 'bg-yellow-500 text-slate-900'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {testState === 'finished' && renderResults()}
    </div>
  );
}
