"""Monthly report API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.balance import acc_summary

bp = Blueprint('report', __name__, url_prefix='/api')

@bp.route('/report', methods=['GET'])
def monthly_report():
    """GET /api/report?month=Jul 2026 - full monthly breakdown."""
    supabase = get_client()
    month = request.args.get('month')

    if not month:
        return jsonify({'error': 'month parameter required'}), 400

    try:
        # Account summary for the month
        summary = acc_summary(month=month)

        # Get months list for navigation
        months_result = supabase.rpc('get_months').execute()
        months = [m['month'] for m in months_result.data] if months_result.data else []

        # Income by category
        income_entries = supabase.table('income_entries').select('category,amount').eq('deleted', False).eq('month', month).execute()
        income_by_category = {}
        for inc in income_entries.data:
            cat = inc['category']
            income_by_category[cat] = income_by_category.get(cat, 0) + float(inc['amount'])

        # Expenses by category
        expenses = supabase.table('expenses').select('category,amount').eq('deleted', False).eq('month', month).execute()
        expenses_by_category = {}
        for exp in expenses.data:
            cat = exp['category']
            expenses_by_category[cat] = expenses_by_category.get(cat, 0) + float(exp['amount'])

        # Expenses by payment method
        expenses_by_method = {}
        for exp in expenses.data:
            pm = exp['payment_method']
            expenses_by_method[pm] = expenses_by_method.get(pm, 0) + float(exp['amount'])

        # Transfers
        transfers = supabase.table('transfers').select('*').eq('deleted', False).eq('month', month).execute()

        result = {
            'month': month,
            'accounts': summary,
            'income_by_category': income_by_category,
            'expenses_by_category': expenses_by_category,
            'expenses_by_method': expenses_by_method,
            'transfers': transfers.data,
            'months': months,
        }

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/months', methods=['GET'])
def list_months():
    """GET /api/months - list all months with data."""
    supabase = get_client()

    try:
        # Get distinct months across all transactional tables
        months_set = set()

        # Tables with 'deleted' column
        for table in ['expenses', 'income_entries', 'transfers']:
            rows = supabase.table(table).select('month').eq('deleted', False).execute()
            for row in rows.data:
                if row['month']:
                    months_set.add(row['month'])

        # debt_entries doesn't have 'deleted' column
        rows = supabase.table('debt_entries').select('month').execute()
        for row in rows.data:
            if row['month']:
                months_set.add(row['month'])

        # Sort by month (chronologically)
        from backend.services.dates import month_key
        months = sorted(months_set, key=month_key, reverse=True)

        return jsonify(months)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
