"""Dashboard API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.balance import acc_summary, sub_monthly_total

bp = Blueprint('dashboard', __name__, url_prefix='/api')

@bp.route('/dashboard', methods=['GET'])
def dashboard():
    """GET /api/dashboard - dashboard summary with all-time and current month data."""
    supabase = get_client()

    try:
        # All-time account balances
        alltime_summary = acc_summary(month=None)

        # Current month expenses/income
        today_str = request.args.get('month')  # Can override with ?month=Jul 2026
        if not today_str:
            from datetime import date
            today_str = date.today().strftime('%b %Y')

        month_summary = acc_summary(month=today_str)

        # Subscription totals
        sub_total = sub_monthly_total()

        # Expense breakdown by category for current month
        expenses = supabase.table('expenses').select('category,amount').eq('deleted', False).eq('month', today_str).execute()
        by_category = {}
        for exp in expenses.data:
            cat = exp['category']
            by_category[cat] = by_category.get(cat, 0) + float(exp['amount'])

        # All accounts for account balance strip
        accounts = supabase.table('bank_accounts').select('*').eq('active', True).order('sort_order').execute()

        result = {
            'alltime': alltime_summary,
            'month': today_str,
            'monthly': month_summary,
            'subscription_total': sub_total,
            'expenses_by_category': by_category,
            'accounts': accounts.data,
        }

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
