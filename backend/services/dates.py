"""Date and month utilities."""
from datetime import datetime

def month_key(month_str):
    """Convert 'Jul 2026' -> 202607 for sorting."""
    try:
        dt = datetime.strptime(month_str, '%b %Y')
        return dt.year * 100 + dt.month
    except ValueError:
        return 0

def date_to_month(date_str):
    """Convert '2026-07-01' -> 'Jul 2026'."""
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        return dt.strftime('%b %Y')
    except ValueError:
        return None
