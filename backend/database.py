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

            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                source TEXT DEFAULT 'curated',
                category TEXT DEFAULT 'seal',
                difficulty INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_quotes_category
                ON quotes(category);

            CREATE INDEX IF NOT EXISTS idx_quotes_difficulty
                ON quotes(difficulty);
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

        # Seed quotes if the table is empty
        seed_quotes(conn)

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


# ─── Quotes ─────────────────────────────────────────────────────────

SEAL_FACTS = [
    {"text": "Seals are pinnipeds, a group of marine mammals that also includes sea lions and walruses.", "difficulty": 2},
    {"text": "There are 33 species of seals found across the world, from the Arctic to the Antarctic.", "difficulty": 2},
    {"text": "The largest seal species is the southern elephant seal. Males can weigh up to 4,000 kilograms!", "difficulty": 3},
    {"text": "Harbour seals can hold their breath for up to 30 minutes while diving for food.", "difficulty": 2},
    {"text": "Seals have a thick layer of blubber under their skin that keeps them warm in freezing waters.", "difficulty": 2},
    {"text": "Unlike dolphins and whales, seals give birth on land or ice, not in the water.", "difficulty": 2},
    {"text": "The word 'pinniped' comes from Latin, meaning 'fin-footed' or 'wing-footed'.", "difficulty": 2},
    {"text": "Baby seals are called pups. They gain weight incredibly fast thanks to their mother's rich milk.", "difficulty": 2},
    {"text": "Some seal pups double their birth weight in just five days. That's like a human baby gaining 30 kilograms!", "difficulty": 3},
    {"text": "Leopard seals are fierce predators that hunt penguins and even other seals in Antarctic waters.", "difficulty": 3},
    {"text": "The Baikal seal is the only seal species that lives exclusively in freshwater, in Russia's Lake Baikal.", "difficulty": 3},
    {"text": "Seals use their whiskers, called vibrissae, to detect fish movements in dark or murky water.", "difficulty": 2},
    {"text": "A seal's whiskers are so sensitive they can track a fish's trail from over 100 metres away.", "difficulty": 2},
    {"text": "The ringed seal is the smallest seal species. Adults rarely grow longer than 1.5 metres.", "difficulty": 2},
    {"text": "Grey seals can be identified by their long, sloping nose — often called a 'Roman nose'.", "difficulty": 2},
    {"text": "During breeding season, male elephant seals engage in violent battles for dominance and mating rights.", "difficulty": 3},
    {"text": "Seals sleep in the water by floating vertically with just their noses above the surface.", "difficulty": 2},
    {"text": "A group of seals on land is called a colony. In the water, it's called a raft.", "difficulty": 1},
    {"text": "The Navy has trained seals to locate underwater objects and assist with military operations.", "difficulty": 2},
    {"text": "Climate change threatens many seal species by melting the sea ice they rely on for breeding.", "difficulty": 2},
    {"text": "The Hawaiian monk seal is one of the most endangered seal species, with fewer than 1,600 left in the wild.", "difficulty": 3},
    {"text": "Seals can slow their heart rate from 100 beats per minute down to just 10 when diving deep.", "difficulty": 2},
    {"text": "Crabeater seals don't actually eat crabs. Their name is a mistranslation — they eat krill!", "difficulty": 2},
    {"text": "The walrus, a close relative of seals, can have tusks over one metre long.", "difficulty": 1},
    {"text": "Seals have excellent underwater vision, but on land they are quite nearsighted.", "difficulty": 1},
    {"text": "Some seal species can dive deeper than 1,500 metres — nearly a mile beneath the ocean surface.", "difficulty": 3},
    {"text": "The harp seal gets its name from the harp-shaped black marking on its back as an adult.", "difficulty": 2},
    {"text": "Weddell seals live farther south than any other mammal, enduring Antarctica's brutal winters.", "difficulty": 2},
    {"text": "A newborn harp seal pup has a fluffy white coat called lanugo, which helps it stay warm before it grows blubber.", "difficulty": 3},
    {"text": "Seals can detect prey using their whiskers even when blindfolded, in completely dark water.", "difficulty": 2},
    {"text": "The Mediterranean monk seal is one of the rarest seals, with only about 700 individuals remaining.", "difficulty": 2},
    {"text": "Fur seals have the densest fur of any mammal, with up to 300,000 hairs per square inch.", "difficulty": 2},
    {"text": "Seals migrate thousands of kilometres each year between feeding and breeding grounds.", "difficulty": 2},
    {"text": "A seal's nostrils automatically close when it dives underwater — no need to hold them shut!", "difficulty": 1},
    {"text": "Elephant seals can stay underwater for nearly two hours without coming up for air.", "difficulty": 2},
    {"text": "The Saimaa ringed seal lives in a single lake in Finland and has a population of about 400.", "difficulty": 3},
    {"text": "Seals shed their fur every year in a process called moulting, which can take several weeks.", "difficulty": 2},
    {"text": "Unlike sea lions, true seals cannot rotate their hind flippers forward, so they move on land by galumphing.", "difficulty": 3},
    {"text": "A seal pup recognises its mother's unique call from a colony of thousands of other seals.", "difficulty": 2},
    {"text": "Seals have been known to rescue drowning humans by nudging them toward the surface.", "difficulty": 2},
    {"text": "The Caspian seal is found only in the Caspian Sea, the world's largest inland body of water.", "difficulty": 3},
    {"text": "Seals eat a wide variety of prey, including fish, squid, octopus, and crustaceans.", "difficulty": 2},
    {"text": "A seal's milk can contain up to 60% fat, making it one of the richest milks in the animal kingdom.", "difficulty": 3},
    {"text": "Spotted seals get their name from the irregular dark spots scattered across their silver-grey coat.", "difficulty": 2},
    {"text": "Bearded seals use their long, bushy whiskers to feel along the ocean floor for clams and crabs.", "difficulty": 2},
    {"text": "Seals are protected by law in many countries, and hunting them is strictly regulated or banned.", "difficulty": 2},
    {"text": "The ribbon seal has striking white bands wrapped around its dark body, making it look like it's wearing ribbons.", "difficulty": 2},
    {"text": "Seals can live up to 30 years in the wild, though many don't survive their first year.", "difficulty": 2},
    {"text": "Hooded seals have an inflatable nasal sac on their heads that males blow up like a red balloon to attract mates.", "difficulty": 3},
    {"text": "Seals communicate with each other using barks, growls, and even slapping the water with their flippers.", "difficulty": 2},
    {"text": "A seal's sense of hearing is incredibly acute underwater, allowing it to locate prey by sound alone.", "difficulty": 2},
    {"text": "Seals are considered a keystone species in many Arctic ecosystems, meaning their health reflects the ocean's health.", "difficulty": 3},
    {"text": "The northern elephant seal was hunted to near extinction in the 1800s, with only about 50 left. Today there are over 200,000!", "difficulty": 3},
    {"text": "Seals have no external ear flaps — just small holes behind their eyes that close when diving.", "difficulty": 2},
    {"text": "Pregnant seals delay embryo implantation, so pups are born at the ideal time of year regardless of when mating occurred.", "difficulty": 3},
    {"text": "Seals spend up to 80% of their lives at sea, only returning to land or ice to rest, moult, and breed.", "difficulty": 2},
    {"text": "The Ross seal is one of the least-known seal species because it lives in remote, ice-choked Antarctic waters.", "difficulty": 3},
    {"text": "Seals have been observed using tools — a grey seal was seen using a rock to scratch its own back.", "difficulty": 2},
    {"text": "Newborn seal pups have no blubber at all. They rely entirely on their mother's warm milk for the first weeks.", "difficulty": 2},
    {"text": "A seal's blood contains unusually high levels of oxygen-carrying proteins, letting it store more oxygen for long dives.", "difficulty": 3},
    {"text": "Seals can nap while floating at the surface, sometimes drifting for hours before waking up.", "difficulty": 2},
    {"text": "Some seal species live in warm tropical waters, like the Galapagos fur seal which thrives near the equator.", "difficulty": 2},
    {"text": "Seals have been known to follow fishing boats for easy meals, learning to steal fish from nets and lines.", "difficulty": 2},
    {"text": "The dental formula of seals varies between species, but most have sharp, pointed teeth perfect for gripping slippery fish.", "difficulty": 3},
    {"text": "Seals are more closely related to bears and weasels than they are to dolphins or whales.", "difficulty": 2},
    {"text": "A seal's heart rate can drop from 120 beats per minute at the surface to just 4 beats per minute during a deep dive.", "difficulty": 3},
    {"text": "Seals have a special membrane that covers their eyes underwater, acting like built-in goggles.", "difficulty": 2},
    {"text": "Harbour seals are the most widely distributed seal species, found along coastlines across the Northern Hemisphere.", "difficulty": 2},
    {"text": "Scientists study seal moulting patterns to understand how environmental toxins accumulate in marine food chains.", "difficulty": 3},
    {"text": "The Ladoga ringed seal lives only in Lake Ladoga in Russia, Europe's largest freshwater lake by area.", "difficulty": 3},
    {"text": "Mother seals fast while nursing their pups, sometimes going weeks without eating while producing rich milk.", "difficulty": 2},
    {"text": "Seals can hear ultrasonic frequencies far beyond human range, which may help them evade orcas and other predators.", "difficulty": 3},
    {"text": "Leopard seals have been known to present penguins to human divers as if trying to teach them how to hunt.", "difficulty": 2},
    {"text": "Some fossil seals date back over 23 million years, making them one of the older groups of marine mammals.", "difficulty": 3},
    {"text": "Seals can voluntarily reduce blood flow to their extremities during a dive, conserving oxygen for their brain and heart.", "difficulty": 3},
    {"text": "Antarctic fur seals were hunted nearly to extinction in the 19th century. Their population has now rebounded to over 4 million.", "difficulty": 3},
    {"text": "Seal pups learn to swim within days of birth, though they usually stay close to shore until they're stronger.", "difficulty": 2},
    {"text": "Seals have been trained by scientists to wear sensors that collect ocean temperature and salinity data.", "difficulty": 2},
    {"text": "The largest seal colony on Earth is on South Georgia island, home to hundreds of thousands of seals at once.", "difficulty": 2},
    {"text": "Seals use their sensitive whiskers to detect the size, shape, and speed of objects in the water without touching them.", "difficulty": 2},
    {"text": "Grey seal populations in the UK have doubled in the last 50 years thanks to conservation efforts.", "difficulty": 2},
    {"text": "Seals can shut down one hemisphere of their brain at a time while sleeping in the water, staying partially alert.", "difficulty": 3},
    {"text": "The Caribbean monk seal was declared extinct in 2008 — the first seal species lost entirely to human activity.", "difficulty": 3},
    {"text": "Every year, thousands of seal pups are born on the ice floes of Canada's Gulf of St. Lawrence.", "difficulty": 2},
    {"text": "Seals have a reflective layer behind their retina called the tapetum lucidum, which gives them excellent night vision.", "difficulty": 3},
    {"text": "Male hooded seals can inflate the red balloon-like sac in their nose in under a second to intimidate rivals.", "difficulty": 3},
    {"text": "Seals produce a variety of underwater vocalisations — trills, chirps, and roars — especially during mating season.", "difficulty": 2},
    {"text": "Scientists can identify individual seals by the unique pattern of spots on their fur, much like a human fingerprint.", "difficulty": 2},
    {"text": "Seals sometimes eat stones and pebbles — researchers think it may help with digestion or buoyancy control.", "difficulty": 2},
    {"text": "The northern fur seal was once known as the 'sea bear' because of its thick fur and bear-like gait on land.", "difficulty": 2},
    {"text": "Seals can use the Earth's magnetic field to navigate during long migrations across open ocean.", "difficulty": 3},
    {"text": "During the breeding season, a single male elephant seal may mate with over 50 females in his harem.", "difficulty": 2},
    {"text": "Seal coronaviruses have been found in some wild populations, though none are known to affect humans.", "difficulty": 3},
    {"text": "Seals sometimes form cooperative hunting groups, working together to herd fish into tight balls before feeding.", "difficulty": 2},
    {"text": "Historic Inuit communities relied on seals for food, clothing, tools, and fuel, using every part of the animal.", "difficulty": 3},
    {"text": "The Australian sea lion has a unique 18-month breeding cycle, unlike any other seal or sea lion species.", "difficulty": 3},
    {"text": "Seal pups can recognise their mother's scent from birth, helping them reunite after she returns from feeding trips.", "difficulty": 2},
    {"text": "The global seal population is estimated to be in the tens of millions, though accurate counts are difficult to obtain.", "difficulty": 2},
]


def seed_quotes(db: sqlite3.Connection):
    """Insert seal facts if the quotes table is empty."""
    count = db.execute("SELECT COUNT(*) AS cnt FROM quotes").fetchone()
    if count["cnt"] == 0:
        for fact in SEAL_FACTS:
            db.execute(
                "INSERT INTO quotes (text, difficulty) VALUES (?, ?)",
                (fact["text"], fact["difficulty"]),
            )
        db.commit()


def get_quotes(
    db: sqlite3.Connection,
    count: int = 10,
    category: str = "seal",
    difficulty: int | None = None,
) -> dict:
    """Return random quotes for a typing session.

    Args:
        db: An open SQLite connection.
        count: Number of quotes to return.
        category: Filter by category.
        difficulty: Optional difficulty filter (1, 2, or 3).

    Returns:
        A dict with "quotes" list and "total_available" count.
    """
    params = [category]
    where = "WHERE category = ?"
    if difficulty is not None:
        where += " AND difficulty = ?"
        params.append(difficulty)

    total_row = db.execute(
        f"SELECT COUNT(*) AS cnt FROM quotes {where}", params
    ).fetchone()
    total = total_row["cnt"] if total_row else 0

    if total == 0:
        return {"quotes": [], "total_available": 0}

    rows = db.execute(
        f"SELECT id, text, source, difficulty FROM quotes {where} "
        f"ORDER BY RANDOM() LIMIT ?",
        params + [count],
    ).fetchall()

    return {
        "quotes": [dict(r) for r in rows],
        "total_available": total,
    }
