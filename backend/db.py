"""Supabase client initialization."""
from supabase import create_client
from backend.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

# Anon client (for frontend calls, respects RLS)
_anon_client = None

# Service client (for backend-only operations, bypasses RLS)
_service_client = None

def get_client(use_service_key=False):
    """Get Supabase client (anon or service role)."""
    global _anon_client, _service_client

    if use_service_key:
        if _service_client is None:
            _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return _service_client
    else:
        if _anon_client is None:
            _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        return _anon_client
