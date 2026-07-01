"""Audit logging (changelog)."""
import json
from datetime import datetime
from backend.db import get_client

def log_change(table_name, row_id, action, details=None):
    """Write to _changelog table."""
    supabase = get_client()

    payload = {
        'table_name': table_name,
        'row_id': row_id,
        'action': action,
        'details': details,
    }

    try:
        supabase.table('_changelog').insert(payload).execute()
    except Exception as e:
        print(f"Warning: Failed to log change: {e}")
