"""SQLite database connection, initialization, and helper functions."""

import json
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "typing_test.db")


def get_db() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory and foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables and indexes on startup if they don't exist."""
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                username TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                wpm REAL NOT NULL,
                accuracy REAL NOT NULL,
                word_accuracy REAL,
                duration_seconds REAL NOT NULL,
                total_keystrokes INTEGER NOT NULL,
                total_words INTEGER NOT NULL,
                correct_words INTEGER NOT NULL,
                word_list TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS keystrokes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                sequence_num INTEGER NOT NULL,
                key_pressed TEXT NOT NULL,
                intended_key TEXT NOT NULL,
                correct INTEGER NOT NULL,
                pressed_at_ms REAL NOT NULL,
                released_at_ms REAL NOT NULL,
                word TEXT NOT NULL,
                word_index INTEGER NOT NULL,
                position_in_word INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_keystrokes_session
                ON keystrokes(session_id);

            CREATE INDEX IF NOT EXISTS idx_keystrokes_key
                ON keystrokes(key_pressed);

            CREATE INDEX IF NOT EXISTS idx_keystrokes_intended
                ON keystrokes(intended_key);
        """)
        conn.commit()

        # Migration: add user_id column to existing sessions table
        _add_user_id_column_if_not_exists(conn)
        # Migration: add username column to existing users table
        _add_username_column_if_not_exists(conn)

        # Now safe to create the user_id index
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
        )
        conn.commit()

    finally:
        conn.close()


def _add_user_id_column_if_not_exists(db: sqlite3.Connection):
    """Add user_id column to sessions if it doesn't exist (for upgrades)."""
    cursor = db.execute("PRAGMA table_info(sessions)")
    columns = [col[1] for col in cursor.fetchall()]
    if "user_id" not in columns:
        db.execute(
            "ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id)"
        )
        db.commit()


def _add_username_column_if_not_exists(db: sqlite3.Connection):
    """Add username column to users if it doesn't exist (for upgrades)."""
    cursor = db.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    if "username" not in columns:
        db.execute("ALTER TABLE users ADD COLUMN username TEXT")
        db.commit()


def get_user_username(db: sqlite3.Connection, user_id: str) -> str | None:
    """Return the username for a user, or None if not set."""
    row = db.execute(
        "SELECT username FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return row["username"] if row else None


def set_user_username(db: sqlite3.Connection, user_id: str, username: str):
    """Set the username for a user."""
    db.execute(
        "UPDATE users SET username = ? WHERE id = ?", (username, user_id)
    )
    db.commit()


def create_session(db: sqlite3.Connection, data: dict, user_id: str = None) -> int:
    """Insert a session and all its keystrokes in a single transaction.

    Args:
        db: An open SQLite connection.
        data: A dict matching the SessionCreate Pydantic model.
        user_id: The authenticated user's Supabase UUID.

    Returns:
        The auto-generated session ID.
    """
    word_list_json = json.dumps(data["word_list"])

    try:
        cursor = db.execute(
            """INSERT INTO sessions
               (user_id, started_at, wpm, accuracy, word_accuracy,
                duration_seconds, total_keystrokes, total_words,
                correct_words, word_list)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                data["started_at"],
                data["wpm"],
                data["accuracy"],
                data["word_accuracy"],
                data["duration_seconds"],
                data["total_keystrokes"],
                data["total_words"],
                data["correct_words"],
                word_list_json,
            ),
        )
        session_id = cursor.lastrowid

        # Prepare keystroke rows for batch insert
        keystroke_rows = []
        for k in data["keystrokes"]:
            keystroke_rows.append((
                session_id,
                k["sequence"],
                k["key"],
                k["intended"],
                1 if k["correct"] else 0,
                k["pressed_at_ms"],
                k["released_at_ms"],
                k["word"],
                k["word_index"],
                k["position_in_word"],
            ))

        db.executemany(
            """INSERT INTO keystrokes
               (session_id, sequence_num, key_pressed, intended_key,
                correct, pressed_at_ms, released_at_ms, word,
                word_index, position_in_word)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            keystroke_rows,
        )

        db.commit()
        return session_id

    except Exception:
        db.rollback()
        raise


def get_key_stats(db: sqlite3.Connection, user_id: str = None) -> dict:
    """Analyse per-key statistics across all sessions for a given user.

    Returns per-key error rates, interkey latency, and hold duration,
    sorted worst-first by error rate. Excludes Space, Backspace,
    and modifier keys.

    Args:
        db: An open SQLite connection.
        user_id: Filter stats to this user. If None, returns all.

    Returns:
        A dict with keys: "keys" (list), "total_keystrokes_analysed",
        and "total_sessions".
    """
    excluded = ("", " ", "Backspace", "Shift", "Control",
                "Alt", "Meta", "Tab", "Enter", "CapsLock")
    placeholders = ",".join("?" for _ in excluded)

    # Build user filter if needed
    user_filter = ""
    user_params = list(excluded)
    if user_id:
        user_filter = (
            "AND k.session_id IN (SELECT id FROM sessions WHERE user_id = ?)"
        )
        user_params.append(user_id)

    # Total keystrokes analysed (excluding filtered keys)
    total_row = db.execute(
        f"""SELECT COUNT(*) AS cnt
            FROM keystrokes k
            WHERE k.intended_key NOT IN ({placeholders})
            {user_filter}""",
        user_params,
    ).fetchone()
    total_analysed = total_row["cnt"] if total_row else 0

    # Total sessions
    if user_id:
        session_row = db.execute(
            "SELECT COUNT(*) AS cnt FROM sessions WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    else:
        session_row = db.execute(
            "SELECT COUNT(*) AS cnt FROM sessions"
        ).fetchone()
    total_sessions = session_row["cnt"] if session_row else 0

    if total_analysed == 0:
        return {
            "keys": [],
            "total_keystrokes_analysed": 0,
            "total_sessions": total_sessions,
        }

    rows = db.execute(
        f"""WITH lagged AS (
            SELECT
                k.intended_key,
                k.correct,
                k.pressed_at_ms,
                k.released_at_ms,
                LAG(k.pressed_at_ms) OVER (
                    PARTITION BY k.session_id ORDER BY k.sequence_num
                ) AS prev_pressed_ms
            FROM keystrokes k
            WHERE k.intended_key NOT IN ({placeholders})
            {user_filter}
        )
        SELECT
            intended_key AS key,
            COUNT(*) AS total,
            SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS errors,
            ROUND(
                CAST(SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS REAL)
                / COUNT(*) * 100, 2
            ) AS error_rate,
            ROUND(AVG(pressed_at_ms - prev_pressed_ms), 2)
                AS avg_interkey_latency_ms,
            ROUND(AVG(released_at_ms - pressed_at_ms), 2)
                AS avg_hold_duration_ms
        FROM lagged
        WHERE prev_pressed_ms IS NOT NULL
        GROUP BY intended_key
        ORDER BY error_rate DESC""",
        user_params,
    ).fetchall()

    keys = [dict(r) for r in rows]

    return {
        "keys": keys,
        "total_keystrokes_analysed": total_analysed,
        "total_sessions": total_sessions,
    }


def get_bigram_stats(db: sqlite3.Connection, user_id: str = None) -> dict:
    """Analyse consecutive key-pair (bigram) statistics across all sessions.

    A bigram is a pair of consecutive intended keys within the same word.
    For example, typing "wheel" produces: wh, he, ee, el.

    Only includes bigrams appearing at least 3 times. Sorted by error rate
    descending (worst first). Excludes pairs involving Space, Backspace,
    or modifier keys.

    Args:
        db: An open SQLite connection.
        user_id: Filter stats to this user. If None, returns all.

    Returns:
        A dict with keys: "bigrams" (list), "total_bigrams_analysed",
        "total_unique_bigrams", and "total_sessions".
    """
    excluded = ("", " ", "Backspace", "Shift", "Control",
                "Alt", "Meta", "Tab", "Enter", "CapsLock")
    placeholders = ",".join("?" for _ in excluded)

    # Build user filter if needed
    user_filter = ""
    user_params = list(excluded) + list(excluded)
    if user_id:
        user_filter = (
            "AND k1.session_id IN (SELECT id FROM sessions WHERE user_id = ?)"
        )
        user_params.append(user_id)

    # Total sessions
    if user_id:
        session_row = db.execute(
            "SELECT COUNT(*) AS cnt FROM sessions WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    else:
        session_row = db.execute(
            "SELECT COUNT(*) AS cnt FROM sessions"
        ).fetchone()
    total_sessions = session_row["cnt"] if session_row else 0

    rows = db.execute(
        f"""SELECT
                k1.intended_key || k2.intended_key AS bigram,
                COUNT(*) AS total_occurrences,
                SUM(CASE WHEN k2.correct = 0 THEN 1 ELSE 0 END) AS errors,
                ROUND(AVG(k2.pressed_at_ms - k1.pressed_at_ms), 2)
                    AS avg_interkey_latency_ms
            FROM keystrokes k1
            JOIN keystrokes k2
                ON k1.session_id = k2.session_id
                AND k1.sequence_num + 1 = k2.sequence_num
                AND k1.word_index = k2.word_index
            WHERE k1.intended_key NOT IN ({placeholders})
              AND k2.intended_key NOT IN ({placeholders})
              {user_filter}
            GROUP BY bigram
            HAVING COUNT(*) >= 3
            ORDER BY errors * 1.0 / COUNT(*) DESC""",
        user_params,
    ).fetchall()

    bigrams = []
    total_occurrences_sum = 0
    for r in rows:
        total = r["total_occurrences"]
        errors = r["errors"]
        total_occurrences_sum += total
        bigrams.append({
            "bigram": r["bigram"],
            "total_occurrences": total,
            "errors": errors,
            "error_rate": round((errors / total) * 100, 2) if total > 0 else 0,
            "avg_interkey_latency_ms": r["avg_interkey_latency_ms"],
        })

    return {
        "bigrams": bigrams,
        "total_bigrams_analysed": total_occurrences_sum,
        "total_unique_bigrams": len(bigrams),
        "total_sessions": total_sessions,
    }


def get_all_sessions(db: sqlite3.Connection, user_id: str = None) -> list[dict]:
    """Return all sessions ordered by created_at descending.

    Does NOT include keystrokes — only session-level data.
    The word_list column is parsed from JSON back to a Python list.

    Args:
        db: An open SQLite connection.
        user_id: Filter sessions to this user. If None, returns all.
    """
    if user_id:
        rows = db.execute(
            "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC"
        ).fetchall()

    sessions = []
    for row in rows:
        r = dict(row)
        r["word_list"] = json.loads(r["word_list"])
        sessions.append(r)

    return sessions
