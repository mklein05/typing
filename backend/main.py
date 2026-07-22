"""FastAPI application for the Typing Test backend."""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

from database import get_db, init_db, create_session, get_all_sessions, get_key_stats
from models import SessionCreate

app = FastAPI(title="Typing Test API", version="1.0")

# ─── CORS ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
):
    """Receive a completed typing test session and store it.

    Validates the request body via Pydantic, inserts a session row
    and all keystrokes in a single transaction.
    """
    try:
        session_id = create_session(db, payload.model_dump())
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save session")

    return {"session_id": session_id, "message": "Session saved successfully"}


@app.get("/api/sessions")
def list_sessions(db: sqlite3.Connection = Depends(get_db_dep)):
    """Return all sessions (newest first), without keystrokes."""
    return get_all_sessions(db)


@app.get("/api/stats/keys")
def key_stats(db: sqlite3.Connection = Depends(get_db_dep)):
    """Return per-key statistics sorted by error rate (worst first)."""
    return get_key_stats(db)


# ─── Run directly ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
