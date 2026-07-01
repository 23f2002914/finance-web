"""Account opening balances API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('account_openings', __name__, url_prefix='/api')

@bp.route('/account-openings', methods=['GET'])
def list_openings():
    """GET /api/account-openings - list all account opening balances."""
    supabase = get_client()

    try:
        openings = supabase.table('account_openings').select('*').order('month', desc=False).execute()
        return jsonify(openings.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/account-openings', methods=['POST'])
def create_opening():
    """POST /api/account-openings - create opening balance."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'month': data.get('month'),
            'account': data.get('account'),
            'opening_balance': validate_amount(data.get('opening_balance', 0)),
        }

        result = supabase.table('account_openings').insert(payload).execute()

        if result.data:
            log_change('account_openings', result.data[0]['id'], 'create', {
                'month': payload['month'],
                'account': payload['account'],
            })
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create opening'}), 500

    except Exception as e:
        if 'unique constraint' in str(e).lower():
            return jsonify({'error': f"Opening already exists for {data.get('month')}/{data.get('account')}"}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/account-openings/<int:id>', methods=['PUT'])
def update_opening(id):
    """PUT /api/account-openings/<id> - update opening balance."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'opening_balance': validate_amount(data.get('opening_balance')),
        }

        result = supabase.table('account_openings').update(payload).eq('id', id).execute()

        if result.data:
            log_change('account_openings', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Opening not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/account-openings/<int:id>', methods=['DELETE'])
def delete_opening(id):
    """DELETE /api/account-openings/<id> - delete opening balance."""
    supabase = get_client()

    try:
        supabase.table('account_openings').delete().eq('id', id).execute()
        log_change('account_openings', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
