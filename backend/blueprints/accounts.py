"""Bank accounts API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.balance import acc_summary
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('accounts', __name__, url_prefix='/api')

@bp.route('/accounts', methods=['GET'])
def list_accounts():
    """GET /api/accounts - list all accounts with closing balances."""
    supabase = get_client()

    try:
        accounts = supabase.table('bank_accounts').select('*').order('sort_order', desc=False).execute()

        # Add closing balance from acc_summary (all-time)
        summary = acc_summary(month=None)

        result = []
        for acc in accounts.data:
            acc_name = acc['name']
            result.append({
                'id': acc['id'],
                'name': acc_name,
                'account_type': acc['account_type'],
                'notes': acc['notes'],
                'active': acc['active'],
                'sort_order': acc['sort_order'],
                'closing_balance': summary.get(acc_name, {}).get('closing', 0),
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/accounts/list', methods=['GET'])
def list_active_accounts():
    """GET /api/accounts/list - list active accounts only (for dropdowns)."""
    supabase = get_client()

    try:
        accounts = supabase.table('bank_accounts').select('id,name').eq('active', True).order('sort_order').execute()
        return jsonify([{'id': a['id'], 'name': a['name']} for a in accounts.data])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/accounts', methods=['POST'])
def create_account():
    """POST /api/accounts - create new account."""
    data = request.json
    supabase = get_client()

    try:
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Account name cannot be empty'}), 400

        payload = {
            'name': name,
            'account_type': data.get('account_type', 'Bank'),
            'notes': data.get('notes', ''),
            'sort_order': data.get('sort_order', 99),
            'active': True,
        }

        result = supabase.table('bank_accounts').insert(payload).execute()

        if result.data:
            log_change('bank_accounts', result.data[0]['id'], 'create', {'name': name})
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create account'}), 500

    except Exception as e:
        if 'unique constraint' in str(e).lower():
            return jsonify({'error': f"Account '{name}' already exists"}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/accounts/<int:id>', methods=['PUT'])
def update_account(id):
    """PUT /api/accounts/<id> - update account."""
    data = request.json
    supabase = get_client()

    try:
        # Get current account to check if name is changing
        current = supabase.table('bank_accounts').select('*').eq('id', id).execute()
        if not current.data:
            return jsonify({'error': 'Account not found'}), 404

        old_name = current.data[0]['name']
        new_name = data.get('name', '').strip() if 'name' in data else None

        if 'name' in data and not new_name:
            return jsonify({'error': 'Account name cannot be empty'}), 400

        payload = {}
        if new_name and new_name != old_name:
            payload['name'] = new_name
        if 'account_type' in data:
            payload['account_type'] = data['account_type']
        if 'notes' in data:
            payload['notes'] = data['notes']
        if 'sort_order' in data:
            payload['sort_order'] = data['sort_order']

        if not payload:
            return jsonify(current.data[0])

        result = supabase.table('bank_accounts').update(payload).eq('id', id).execute()

        if result.data:
            log_change('bank_accounts', id, 'update', {
                'from': old_name,
                'to': new_name if new_name else old_name
            })
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Failed to update account'}), 500

    except Exception as e:
        if 'unique constraint' in str(e).lower():
            return jsonify({'error': f"Account '{new_name}' already exists"}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/accounts/<int:id>', methods=['DELETE'])
def delete_account(id):
    """DELETE /api/accounts/<id> - delete account."""
    supabase = get_client()

    try:
        # Get account to log its name
        current = supabase.table('bank_accounts').select('name').eq('id', id).execute()
        if not current.data:
            return jsonify({'error': 'Account not found'}), 404

        account_name = current.data[0]['name']

        # Note: In Postgres, FK cascade will handle cleanup automatically
        # (account_openings, expenses, income_entries, transfers all reference by name with ON CASCADE)
        result = supabase.table('bank_accounts').delete().eq('id', id).execute()

        log_change('bank_accounts', id, 'delete', {'name': account_name})
        return jsonify({'ok': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
