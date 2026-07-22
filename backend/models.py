"""Pydantic models for the Typing Test API."""

from pydantic import BaseModel


class KeystrokeData(BaseModel):
    """A single keystroke recorded during a typing test."""
    sequence: int
    key: str
    intended: str
    correct: bool
    pressed_at_ms: float
    released_at_ms: float
    word: str
    word_index: int
    position_in_word: int


class SessionCreate(BaseModel):
    """Payload for creating a new typing test session."""
    started_at: str
    wpm: float
    accuracy: float
    word_accuracy: float | None = None
    duration_seconds: float
    total_keystrokes: int
    total_words: int
    correct_words: int
    word_list: list[str]
    keystrokes: list[KeystrokeData]
