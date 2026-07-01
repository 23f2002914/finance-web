"""Expenses API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client
from backend.services.dates import date_to_month
from backend.services.audit import log_change
from backend.services.validators import validate_amount, validate_split_total

bp = Blueprint('expenses', __name__, url_prefix='/api')

@bp.route('/expenses', methods=['GET'])
def list_expenses():
    """GET /api/expenses - list expenses with optional filters and splits."""
    supabase = get_client()
    month = request.args.get('month')
    category = request.args.get('category')
    account = request.args.get('account')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    try:
        query = supabase.table('expenses').select('*').eq('deleted', False)

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
        expenses = query.order('date', desc=True).range(offset, offset + limit - 1).execute()

        # Attach splits for split expenses
        for exp in expenses.data:
            if exp.get('is_split'):
                splits = supabase.table('expense_splits').select('*').eq('expense_id', exp['id']).execute()
                exp['splits'] = splits.data
            else:
                exp['splits'] = []

        return jsonify({
            'data': expenses.data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/expenses', methods=['POST'])
def create_expense():
    """POST /api/expenses - create expense with optional splits."""
    data = request.json
    supabase = get_client()

    try:
        date = data.get('date')
        month = date_to_month(date)
        is_split = data.get('is_split', False)
        splits = data.get('splits', [])
        amount = validate_amount(data.get('amount'))

        # Validate split total if split
        if is_split and splits:
            validate_split_total(splits, amount)

        payload = {
            'date': date,
            'description': data.get('description', ''),
            'category': data.get('category', 'Other'),
            'account': data.get('account', 'Kotak'),
            'payment_method': data.get('payment_method', 'UPI'),
            'amount': amount,
            'month': month,
            'notes': data.get('notes', ''),
            'is_recurring': data.get('is_recurring', False),
            'is_split': is_split,
            'deleted': False,
        }

        result = supabase.table('expenses').insert(payload).execute()

        if not result.data:
            return jsonify({'error': 'Failed to create expense'}), 500

        expense_id = result.data[0]['id']

        # Create splits if any
        if is_split and splits:
            split_payloads = [
                {
                    'expense_id': expense_id,
                    'category': s.get('category'),
                    'amount': validate_amount(s.get('amount')),
                    'description': s.get('description', ''),
                }
                for s in splits
            ]
            supabase.table('expense_splits').insert(split_payloads).execute()
            result.data[0]['splits'] = split_payloads
        else:
            result.data[0]['splits'] = []

        log_change('expenses', expense_id, 'create', {
            'category': payload['category'],
            'amount': payload['amount'],
            'is_split': is_split,
        })

        return jsonify(result.data[0]), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/expenses/<int:id>', methods=['PUT'])
def update_expense(id):
    """PUT /api/expenses/<id> - update expense and splits."""
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

        # Handle splits if provided
        if 'splits' in data:
            if data['splits']:
                validate_split_total(data['splits'], payload.get('amount', data.get('amount')))
                # Delete old splits and create new ones
                supabase.table('expense_splits').delete().eq('expense_id', id).execute()
                split_payloads = [
                    {
                        'expense_id': id,
                        'category': s.get('category'),
                        'amount': validate_amount(s.get('amount')),
                        'description': s.get('description', ''),
                    }
                    for s in data['splits']
                ]
                supabase.table('expense_splits').insert(split_payloads).execute()
            payload['is_split'] = bool(data['splits'])

        result = supabase.table('expenses').update(payload).eq('id', id).execute()

        if result.data:
            log_change('expenses', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Expense not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/expenses/<int:id>', methods=['DELETE'])
def delete_expense(id):
    """DELETE /api/expenses/<id> - soft delete expense."""
    supabase = get_client()

    try:
        supabase.table('expenses').update({'deleted': True}).eq('id', id).execute()
        log_change('expenses', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/expenses/<int:id>/restore', methods=['POST'])
def restore_expense(id):
    """POST /api/expenses/<id>/restore - undo soft delete."""
    supabase = get_client()

    try:
        supabase.table('expenses').update({'deleted': False}).eq('id', id).execute()
        log_change('expenses', id, 'restore')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/expenses/<int:id>/copy-next-month', methods=['POST'])
def copy_expense_next_month(id):
    """POST /api/expenses/<id>/copy-next-month - copy to next month."""
    supabase = get_client()

    try:
        from datetime import datetime

        # Fetch the expense
        result = supabase.table('expenses').select('*').eq('id', id).execute()
        if not result.data:
            return jsonify({'error': 'Expense not found'}), 404

        row = result.data[0]

        # Fetch splits if any
        splits_result = supabase.table('expense_splits').select('*').eq('expense_id', id).execute()
        splits = splits_result.data

        # Parse date and move to next month
        dt = datetime.strptime(row['date'], '%Y-%m-%d')
        if dt.month == 12:
            nd = dt.replace(year=dt.year + 1, month=1)
        else:
            nd = dt.replace(month=dt.month + 1)

        new_date = nd.strftime('%Y-%m-%d')
        new_month = date_to_month(new_date)

        # Create new expense
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
            'is_split': row['is_split'],
            'deleted': False,
        }

        new_result = supabase.table('expenses').insert(payload).execute()

        if not new_result.data:
            return jsonify({'error': 'Failed to copy'}), 500

        new_id = new_result.data[0]['id']

        # Copy splits if any
        if splits:
            split_payloads = [
                {
                    'expense_id': new_id,
                    'category': s['category'],
                    'amount': s['amount'],
                    'description': s['description'],
                }
                for s in splits
            ]
            supabase.table('expense_splits').insert(split_payloads).execute()

        log_change('expenses', new_id, 'create', {'copied_from': id})
        return jsonify({'ok': True, 'month': new_month})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
