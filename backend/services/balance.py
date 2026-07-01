"""Account balance calculations via RPC."""
from backend.db import get_client

def acc_summary(month=None):
    """Get account summary (opening, income, expenses, transfers, closing).

    Args:
        month: 'Jul 2026' for monthly, None for all-time

    Returns:
        dict: {account_name: {opening, income, expenses, transfers_in, transfers_out, closing}}
    """
    supabase = get_client()

    try:
        result = supabase.rpc('acc_summary', {'p_month': month}).execute()

        # Transform array of rows into dict keyed by account name
        summary = {}
        for row in result.data:
            summary[row['account']] = {
                'opening': float(row['opening']),
                'income': float(row['income']),
                'transfers_in': float(row['transfers_in']),
                'transfers_out': float(row['transfers_out']),
                'expenses': float(row['expenses']),
                'closing': float(row['closing']),
            }
        return summary
    except Exception as e:
        print(f"Error calling acc_summary: {e}")
        return {}

def sub_monthly_total():
    """Get total monthly subscription amount."""
    supabase = get_client()

    try:
        result = supabase.rpc('sub_monthly_total').execute()
        return float(result.data or 0)
    except Exception as e:
        print(f"Error calling sub_monthly_total: {e}")
        return 0.0
