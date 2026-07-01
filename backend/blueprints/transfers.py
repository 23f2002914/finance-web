"""Transfers API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.dates import date_to_month
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('transfers', __name__, url_prefix='/api')

@bp.route('/transfers', methods=['GET'])
def list_transfers():
    """GET /api/transfers - list all transfers."""
    supabase = get_client()
    month = request.args.get('month')

    try:
        query = supabase.table('transfers').select('*').eq('deleted', False)
        if month:
            query = query.eq('month', month)
        transfers = query.order('date', desc=True).execute()
        return jsonify(transfers.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/transfers', methods=['POST'])
def create_transfer():
    """POST /api/transfers - create transfer."""
    data = request.json
    supabase = get_client()

    try:
        from_account = data.get('from_account')
        to_account = data.get('to_account')

        if from_account == to_account:
            return jsonify({'error': 'Cannot transfer to the same account'}), 400

        date = data.get('date')
        month = date_to_month(date)

        payload = {
            'date': date,
            'from_account': from_account,
            'to_account': to_account,
            'amount': validate_amount(data.get('amount')),
            'payment_method': data.get('payment_method', 'IMPS'),
            'description': data.get('description', ''),
            'notes': data.get('notes', ''),
            'month': month,
            'deleted': False,
        }

        # Check for duplicate
        existing = supabase.table('transfers').select('id').eq('date', date).eq('from_account', from_account).eq('to_account', to_account).eq('amount', payload['amount']).eq('deleted', False).execute()
        if existing.data:
            return jsonify({'error': 'Duplicate transfer (same date/accounts/amount)'}), 400

        result = supabase.table('transfers').insert(payload).execute()

        if result.data:
            log_change('transfers', result.data[0]['id'], 'create', {
                'from': from_account,
                'to': to_account,
                'amount': payload['amount'],
            })
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create transfer'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/transfers/<int:id>', methods=['PUT'])
def update_transfer(id):
    """PUT /api/transfers/<id> - update transfer."""
    data = request.json
    supabase = get_client()

    try:
        date = data.get('date')
        month = date_to_month(date) if date else None

        payload = {}
        if date:
            payload['date'] = date
        if month:
            payload['month'] = month
        if 'from_account' in data:
            payload['from_account'] = data['from_account']
        if 'to_account' in data:
            payload['to_account'] = data['to_account']
        if 'amount' in data:
            payload['amount'] = validate_amount(data['amount'])
        if 'payment_method' in data:
            payload['payment_method'] = data['payment_method']
        if 'description' in data:
            payload['description'] = data['description']
        if 'notes' in data:
            payload['notes'] = data['notes']

        # Check that from != to
        if 'from_account' in payload and 'to_account' in payload:
            if payload['from_account'] == payload['to_account']:
                return jsonify({'error': 'Cannot transfer to the same account'}), 400

        result = supabase.table('transfers').update(payload).eq('id', id).execute()

        if result.data:
            log_change('transfers', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Transfer not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/transfers/<int:id>', methods=['DELETE'])
def delete_transfer(id):
    """DELETE /api/transfers/<id> - soft delete transfer."""
    supabase = get_client()

    try:
        supabase.table('transfers').update({'deleted': True}).eq('id', id).execute()
        log_change('transfers', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/transfers/<int:id>/restore', methods=['POST'])
def restore_transfer(id):
    """POST /api/transfers/<id>/restore - undo soft delete."""
    supabase = get_client()

    try:
        supabase.table('transfers').update({'deleted': False}).eq('id', id).execute()
        log_change('transfers', id, 'restore')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
