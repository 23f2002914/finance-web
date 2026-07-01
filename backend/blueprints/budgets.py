"""Budget API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.balance import acc_summary
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('budgets', __name__, url_prefix='/api')

@bp.route('/budgets', methods=['GET'])
def list_budgets():
    """GET /api/budgets - list all budgets, optionally with spend for a month."""
    supabase = get_client()
    month = request.args.get('month')

    try:
        budgets = supabase.table('budgets').select('*').execute()

        result = []
        for budget in budgets.data:
            item = {
                'id': budget['id'],
                'category': budget['category'],
                'monthly_limit': float(budget['monthly_limit']),
            }

            # If month specified, compute spend from expenses
            if month:
                expenses = supabase.table('expenses').select('amount').eq('category', budget['category']).eq('month', month).eq('deleted', False).execute()
                spend = sum(float(e['amount']) for e in expenses.data)
                item['spend'] = round(spend, 2)
                item['remaining'] = round(item['monthly_limit'] - spend, 2)
                item['pct'] = round((spend / item['monthly_limit'] * 100) if item['monthly_limit'] > 0 else 0, 1)

            result.append(item)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/budgets', methods=['POST'])
def create_budget():
    """POST /api/budgets - create budget."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'category': data.get('category'),
            'monthly_limit': validate_amount(data.get('monthly_limit', 0)),
        }

        result = supabase.table('budgets').insert(payload).execute()

        if result.data:
            log_change('budgets', result.data[0]['id'], 'create', {'category': payload['category']})
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create budget'}), 500

    except Exception as e:
        if 'unique constraint' in str(e).lower():
            return jsonify({'error': f"Budget for '{data.get('category')}' already exists"}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/budgets/<int:id>', methods=['PUT'])
def update_budget(id):
    """PUT /api/budgets/<id> - update budget."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'monthly_limit': validate_amount(data.get('monthly_limit')),
        }

        result = supabase.table('budgets').update(payload).eq('id', id).execute()

        if result.data:
            log_change('budgets', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Budget not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/budgets/<int:id>', methods=['DELETE'])
def delete_budget(id):
    """DELETE /api/budgets/<id> - delete budget."""
    supabase = get_client()

    try:
        supabase.table('budgets').delete().eq('id', id).execute()
        log_change('budgets', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
