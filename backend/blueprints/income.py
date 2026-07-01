"""Income entries API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.dates import date_to_month
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('income', __name__, url_prefix='/api')

@bp.route('/income-entries', methods=['GET'])
def list_income():
    """GET /api/income-entries - list income entries with optional filters."""
    supabase = get_client()
    month = request.args.get('month')
    category = request.args.get('category')
    account = request.args.get('account')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    try:
        query = supabase.table('income_entries').select('*').eq('deleted', False)

        if month:
            query = query.eq('month', month)
        if category:
            query = query.eq('category', category)
        if account:
            query = query.eq('account', account)

        # Get total count
        count_result = query.select('id', count='exact').execute()
        total = count_result.count

        # Get paginated results
        income = query.order('date', desc=True).range(offset, offset + limit - 1).execute()

        return jsonify({
            'data': income.data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/income-entries', methods=['POST'])
def create_income():
    """POST /api/income-entries - create income entry."""
    data = request.json
    supabase = get_client()

    try:
        date = data.get('date')
        month = date_to_month(date)

        payload = {
            'date': date,
            'description': data.get('description', ''),
            'category': data.get('category', 'Other'),
            'account': data.get('account', 'Kotak'),
            'payment_method': data.get('payment_method', 'UPI'),
            'amount': validate_amount(data.get('amount')),
            'month': month,
            'notes': data.get('notes', ''),
            'is_recurring': data.get('is_recurring', False),
            'deleted': False,
        }

        result = supabase.table('income_entries').insert(payload).execute()

        if result.data:
            log_change('income_entries', result.data[0]['id'], 'create', {
                'category': payload['category'],
                'amount': payload['amount'],
            })
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create income'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/income-entries/<int:id>', methods=['PUT'])
def update_income(id):
    """PUT /api/income-entries/<id> - update income entry."""
    data = request.json
    supabase = get_client()

    try:
        payload = {}

        if 'date' in data:
            payload['date'] = data['date']
            payload['month'] = date_to_month(data['date'])
        if 'description' in data:
            payload['description'] = data['description']
        if 'category' in data:
            payload['category'] = data['category']
        if 'account' in data:
            payload['account'] = data['account']
        if 'payment_method' in data:
            payload['payment_method'] = data['payment_method']
        if 'amount' in data:
            payload['amount'] = validate_amount(data['amount'])
        if 'notes' in data:
            payload['notes'] = data['notes']
        if 'is_recurring' in data:
            payload['is_recurring'] = data['is_recurring']

        result = supabase.table('income_entries').update(payload).eq('id', id).execute()

        if result.data:
            log_change('income_entries', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Income entry not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/income-entries/<int:id>', methods=['DELETE'])
def delete_income(id):
    """DELETE /api/income-entries/<id> - soft delete income entry."""
    supabase = get_client()

    try:
        supabase.table('income_entries').update({'deleted': True}).eq('id', id).execute()
        log_change('income_entries', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/income-entries/<int:id>/restore', methods=['POST'])
def restore_income(id):
    """POST /api/income-entries/<id>/restore - undo soft delete."""
    supabase = get_client()

    try:
        supabase.table('income_entries').update({'deleted': False}).eq('id', id).execute()
        log_change('income_entries', id, 'restore')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/income-entries/<int:id>/copy-next-month', methods=['POST'])
def copy_income_next_month(id):
    """POST /api/income-entries/<id>/copy-next-month - copy to next month."""
    supabase = get_client()

    try:
        from datetime import datetime

        # Fetch the income entry
        result = supabase.table('income_entries').select('*').eq('id', id).execute()
        if not result.data:
            return jsonify({'error': 'Income entry not found'}), 404

        row = result.data[0]

        # Parse date and move to next month
        dt = datetime.strptime(row['date'], '%Y-%m-%d')
        if dt.month == 12:
            nd = dt.replace(year=dt.year + 1, month=1)
        else:
            nd = dt.replace(month=dt.month + 1)

        new_date = nd.strftime('%Y-%m-%d')
        new_month = date_to_month(new_date)

        # Create new entry
        payload = {
            'date': new_date,
            'description': row['description'],
            'category': row['category'],
            'account': row['account'],
            'payment_method': row['payment_method'],
            'amount': row['amount'],
            'month': new_month,
            'notes': row['notes'],
            'is_recurring': row['is_recurring'],
            'deleted': False,
        }

        new_result = supabase.table('income_entries').insert(payload).execute()

        if new_result.data:
            log_change('income_entries', new_result.data[0]['id'], 'create', {'copied_from': id})
            return jsonify({'ok': True, 'month': new_month})
        else:
            return jsonify({'error': 'Failed to copy'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500
