"""JWT verification for Supabase Auth.

Uses the Supabase client library to verify tokens via Supabase's API.
"""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

SUPABASE_URL = "https://cgftqfaopajqzymgrbcx.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZnRxZmFvcGFqcXp5bWdyYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTU5MDksImV4cCI6MjEwMDQ5MTkwOX0.DIiYn1Sc-3fihBev0UYlf5lRVHpKmOl1QM925KiWQ1M"

_supabase: Client | None = None


def get_supabase() -> Client:
    """Return a cached Supabase client instance."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _supabase


# FastAPI dependency
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency: verify the JWT and extract user_id.

    Uses Supabase's own auth.get_user() which validates the token
    against Supabase's servers.

    Use as:  user_id: str = Depends(get_current_user)
    """
    token = credentials.credentials
    try:
        supabase = get_supabase()
        user_response = supabase.auth.get_user(token)
        user_id = user_response.user.id
        print(f"[auth] User verified: {user_id}")
        return user_id
    except Exception as e:
        print(f"[auth] Auth failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
