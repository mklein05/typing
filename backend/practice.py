"""Practice test generator — analyses weak bigrams and generates
targeted word lists and bigram drills for improvement."""

import random
import sqlite3

from database import get_bigram_stats

# ─── Word bank (~400 common English words with diverse bigrams) ─────
WORD_BANK = [
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
    "young", "your",
]


def extract_bigrams(word: str) -> list[str]:
    """Extract all consecutive 2-character pairs from a word.

    Example: "there" → ["th", "he", "er", "re"]
    """
    return [word[i] + word[i + 1] for i in range(len(word) - 1)]


def score_word(word: str, weak_bigrams: dict, worst_bigram: str) -> float:
    """Score a word based on how many weak bigrams it contains.

    Each matching weak bigram contributes its error_rate to the score.
    The worst bigram gets a 1.5× weighting boost.
    Multiple distinct weak bigrams in one word get a 1.2× bonus per extra match.

    Args:
        word: The word to score.
        weak_bigrams: Dict mapping bigram → error_rate.
        worst_bigram: The single worst bigram (for weighting boost).

    Returns:
        A float score (higher = better practice word).
    """
    word_bigrams = extract_bigrams(word)
    score = 0.0
    matches = 0

    for bg in word_bigrams:
        if bg in weak_bigrams:
            weight = weak_bigrams[bg]
            if bg == worst_bigram:
                weight *= 1.5  # boost for the worst bigram
            score += weight
            matches += 1

    # Bonus for words containing multiple weak bigrams
    if matches > 1:
        score *= 1.0 + (matches - 1) * 0.2

    return score


def generate_drill(weak_bigrams: list[dict], reps: int = 5) -> str:
    """Generate a pure bigram drill string for muscle memory.

    Example: "er er er er er  in in in in in  th th th th th"

    Args:
        weak_bigrams: List of bigram dicts with at least "bigram" key.
        reps: How many times to repeat each bigram.

    Returns:
        A space-separated drill string.
    """
    parts = []
    for bg_info in weak_bigrams:
        bg = bg_info["bigram"]
        parts.extend([bg] * reps)
    return "  ".join(parts)  # double-space between different bigrams


def generate_practice(
    db: sqlite3.Connection,
    count: int = 10,
    word_count: int = 35,
) -> dict:
    """Generate a targeted practice test based on the user's weakest bigrams.

    Args:
        db: An open SQLite connection.
        count: Number of weak bigrams to target (default 10).
        word_count: Number of words in the generated test (default 35).

    Returns:
        A dict with targeted_bigrams, practice_words, drill_text, and metadata.
    """
    # ── Step 1: Get weak bigrams ──────────────────────────────────
    bigram_stats = get_bigram_stats(db)
    all_bigrams = bigram_stats.get("bigrams", [])
    total_sessions = bigram_stats.get("total_sessions", 0)

    # No sessions yet
    if total_sessions == 0:
        return {
            "error": "Complete at least one typing test first",
            "practice_words": [],
            "drill_text": "",
            "total_words": 0,
            "total_bigrams_targeted": 0,
            "targeted_bigrams": [],
        }

    # Filter to bigrams with error_rate > 0 (we only care about mistakes)
    weak = [b for b in all_bigrams if b["error_rate"] > 0]

    if len(weak) < 3:
        return {
            "warning": (
                f"Need more typing data. Only found {len(weak)} bigrams "
                "with errors. Keep practicing!"
            ),
            "targeted_bigrams": weak,
            "practice_words": _fallback_words(word_count),
            "drill_text": generate_drill(weak) if weak else "",
            "total_words": word_count,
            "total_bigrams_targeted": len(weak),
        }

    # Take top N weak bigrams
    targeted = weak[:count]

    # ── Step 2: Build lookup dicts ─────────────────────────────────
    weak_dict = {b["bigram"]: b["error_rate"] for b in targeted}
    worst = targeted[0]["bigram"]  # already sorted by error_rate desc

    # ── Step 3: Score all words ───────────────────────────────────
    scored = []
    for word in WORD_BANK:
        s = score_word(word, weak_dict, worst)
        if s > 0:
            scored.append((word, s))

    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)

    # ── Step 4: Select words for the test ─────────────────────────
    practice_words = []
    if scored:
        # Take top-scoring words, allow repetition of very high scorers
        top_words = [w for w, _ in scored]
        idx = 0
        while len(practice_words) < word_count:
            practice_words.append(top_words[idx % len(top_words)])
            idx += 1
    else:
        practice_words = _fallback_words(word_count)

    # Slight shuffle so the test doesn't feel too mechanical
    random.shuffle(practice_words)

    # ── Step 5: Generate drill ────────────────────────────────────
    drill_text = generate_drill(targeted)

    return {
        "targeted_bigrams": [
            {"bigram": b["bigram"], "error_rate": b["error_rate"]}
            for b in targeted
        ],
        "practice_words": practice_words,
        "drill_text": drill_text,
        "total_words": len(practice_words),
        "total_bigrams_targeted": len(targeted),
    }


def _fallback_words(count: int) -> list[str]:
    """Return random words from the bank when not enough data exists."""
    return random.sample(
        WORD_BANK,
        min(count, len(WORD_BANK)),
    )
