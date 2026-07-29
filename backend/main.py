"""FastAPI application for the Typing Test backend."""

import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

from database import get_db, init_db, create_session, get_all_sessions, get_key_stats, get_bigram_stats, get_user_username, set_user_username
from models import SessionCreate
from practice import generate_practice
from auth import get_current_user

app = FastAPI(title="Typing Test API", version="1.0")

# ─── CORS ───────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Startup ────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    """Initialize the database tables on application startup."""
    init_db()


# ─── Dependencies ───────────────────────────────────────────────────
def get_db_dep():
    """FastAPI dependency that provides a database connection."""
    db = get_db()
    try:
        yield db
    finally:
        db.close()


# ─── Routes ─────────────────────────────────────────────────────────
@app.get("/")
def root():
    """Health-check / info endpoint."""
    return {"message": "Typing Test API", "version": "1.0"}


@app.post("/api/sessions", status_code=201)
def create_session_endpoint(
    payload: SessionCreate,
    db: sqlite3.Connection = Depends(get_db_dep),
    user_id: str = Depends(get_current_user),
):
    """Receive a completed typing test session and store it.

    Validates the request body via Pydantic, inserts a session row
    and all keystrokes in a single transaction.
    """
    try:
        # Ensure the user exists in our local database
        existing = db.execute(
            "SELECT id FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not existing:
            db.execute("INSERT INTO users (id) VALUES (?)", (user_id,))
            db.commit()

        session_id = create_session(db, payload.model_dump(), user_id=user_id)
    except Exception as e:
        print(f"[main] create_session failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save session")

    return {"session_id": session_id, "message": "Session saved successfully"}


@app.get("/api/sessions")
def list_sessions(
    db: sqlite3.Connection = Depends(get_db_dep),
    user_id: str = Depends(get_current_user),
):
    """Return all sessions (newest first), without keystrokes."""
    return get_all_sessions(db, user_id=user_id)


@app.get("/api/stats/keys")
def key_stats(
    db: sqlite3.Connection = Depends(get_db_dep),
    user_id: str = Depends(get_current_user),
):
    """Return per-key statistics sorted by error rate (worst first)."""
    return get_key_stats(db, user_id=user_id)


@app.get("/api/stats/bigrams")
def bigram_stats(
    db: sqlite3.Connection = Depends(get_db_dep),
    user_id: str = Depends(get_current_user),
):
    """Return bigram (key-pair) statistics sorted by error rate (worst first)."""
    return get_bigram_stats(db, user_id=user_id)


@app.get("/api/practice/generate")
def practice_generate(
    count: int = 10,
    word_count: int = 35,
    db: sqlite3.Connection = Depends(get_db_dep),
    user_id: str = Depends(get_current_user),
):
    """Generate a practice test targeting the user's weakest bigrams."""
    return generate_practice(
        db, count=count, word_count=word_count, user_id=user_id
    )


# ─── User management ────────────────────────────────────────────────

class UserEnsure(BaseModel):
    email: str | None = None


@app.post("/api/users/me")
def ensure_user(
    body: UserEnsure | None = None,
    user_id: str = Depends(get_current_user),
):
    """Ensure the authenticated user exists in our local database."""
    db = get_db()
    try:
        existing = db.execute(
            "SELECT id FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not existing:
            email = body.email if body else None
            db.execute(
                "INSERT INTO users (id, email) VALUES (?, ?)",
                (user_id, email),
            )
            db.commit()
        elif body and body.email:
            db.execute(
                "UPDATE users SET email = ? WHERE id = ?",
                (body.email, user_id),
            )
            db.commit()
    finally:
        db.close()

    return {"user_id": user_id, "message": "User ready"}


class SetUsername(BaseModel):
    username: str


@app.get("/api/users/username")
def get_username(user_id: str = Depends(get_current_user)):
    """Get the current user's username. Returns null if not set."""
    db = get_db()
    try:
        username = get_user_username(db, user_id)
    finally:
        db.close()
    return {"username": username}


@app.post("/api/users/username")
def set_username(
    body: SetUsername,
    user_id: str = Depends(get_current_user),
):
    """Set the current user's username."""
    username = body.username.strip()
    if len(username) < 2 or len(username) > 20:
        raise HTTPException(
            status_code=400,
            detail="Username must be between 2 and 20 characters",
        )
    db = get_db()
    try:
        set_user_username(db, user_id, username)
    finally:
        db.close()
    return {"username": username, "message": "Username set"}


# ─── Run directly ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
