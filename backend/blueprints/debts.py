"""Debts API endpoints (creditors + entries + payment tracking)."""
from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.db import get_client
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('debts', __name__, url_prefix='/api')

# ============= Debt Creditors =============

@bp.route('/debt-creditors', methods=['GET'])
def list_creditors():
    """GET /api/debt-creditors - list all debt creditors."""
    supabase = get_client()

    try:
        creditors = supabase.table('debt_creditors').select('*').order('sort_order').execute()
        return jsonify(creditors.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debt-creditors', methods=['POST'])
def create_creditor():
    """POST /api/debt-creditors - create creditor."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'name': data.get('name'),
            'sort_order': data.get('sort_order', 99),
            'active': True,
        }

        result = supabase.table('debt_creditors').insert(payload).execute()

        if result.data:
            log_change('debt_creditors', result.data[0]['id'], 'create', {'name': payload['name']})
            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create creditor'}), 500

    except Exception as e:
        if 'unique constraint' in str(e).lower():
            return jsonify({'error': f"Creditor '{data.get('name')}' already exists"}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/debt-creditors/<int:id>', methods=['PUT'])
def update_creditor(id):
    """PUT /api/debt-creditors/<id> - update creditor."""
    data = request.json
    supabase = get_client()

    try:
        payload = {}
        if 'name' in data:
            payload['name'] = data['name']
        if 'sort_order' in data:
            payload['sort_order'] = data['sort_order']
        if 'active' in data:
            payload['active'] = data['active']

        result = supabase.table('debt_creditors').update(payload).eq('id', id).execute()

        if result.data:
            log_change('debt_creditors', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Creditor not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debt-creditors/<int:id>', methods=['DELETE'])
def delete_creditor(id):
    """DELETE /api/debt-creditors/<id> - delete creditor if no entries reference it."""
    supabase = get_client()

    try:
        # Check if any debt_entries reference this creditor
        entries = supabase.table('debt_entries').select('id').eq('creditor_id', id).limit(1).execute()
        if entries.data:
            return jsonify({'error': 'Cannot delete creditor with existing debt entries'}), 400

        supabase.table('debt_creditors').delete().eq('id', id).execute()
        log_change('debt_creditors', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============= Debt Entries =============

@bp.route('/debts', methods=['GET'])
def list_debts():
    """GET /api/debts - list debt entries by month with creditor details."""
    supabase = get_client()
    month = request.args.get('month')

    try:
        # Fetch all creditors
        creditors = supabase.table('debt_creditors').select('id,name').eq('active', True).order('sort_order').execute()

        # Fetch debt entries
        query = supabase.table('debt_entries').select('*')
        if month:
            query = query.eq('month', month)
        entries = query.order('month', desc=True).execute()

        # Fetch subscriptions for totals
        subs = supabase.table('subscriptions').select('*').eq('status', 'active').eq('deleted', False).execute()

        # Group by month
        from collections import defaultdict
        by_month = defaultdict(lambda: {'entries': {}, 'subscriptions': 0, 'total': 0})

        for entry in entries.data:
            month_key = entry['month']
            creditor_id = entry['creditor_id']
            by_month[month_key]['entries'][creditor_id] = entry

        # Compute subscription totals per month
        for sub in subs.data:
            # Approximate: sum active subscriptions for each month (simplified)
            amount = sub['amount']
            if sub['billing_cycle'] == 'annual':
                amount = amount / 12
            # This is simplified; in a real app, would check subscription_payments
            for month_key in by_month:
                by_month[month_key]['subscriptions'] += amount

        # Build response
        result = []
        for month_key in sorted(by_month.keys(), reverse=True):
            month_data = by_month[month_key]
            total_debts = sum(e['amount'] for e in month_data['entries'].values())
            total = total_debts + month_data['subscriptions']

            result.append({
                'month': month_key,
                'creditors': creditors.data,
                'entries': month_data['entries'],
                'subscriptions': month_data['subscriptions'],
                'total': total,
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debts/history', methods=['GET'])
def debt_history():
    """GET /api/debts/history - time series of debt by creditor."""
    supabase = get_client()

    try:
        # Fetch all entries grouped by creditor
        entries = supabase.table('debt_entries').select('*').order('month').execute()

        from collections import defaultdict
        by_creditor = defaultdict(list)

        for entry in entries.data:
            by_creditor[entry['creditor_id']].append({
                'month': entry['month'],
                'amount': entry['amount'],
                'amount_paid': entry['amount_paid'],
                'status': entry['status'],
            })

        return jsonify(by_creditor)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debts', methods=['POST'])
def upsert_debts():
    """POST /api/debts - upsert debt entries for a month."""
    data = request.json
    supabase = get_client()

    try:
        month = data.get('month')
        entries = data.get('entries', [])  # List of {creditor_id, amount}

        for entry in entries:
            creditor_id = entry.get('creditor_id')
            amount = validate_amount(entry.get('amount', 0))

            # Upsert (insert or replace)
            if amount == 0:
                # Delete if amount is 0
                supabase.table('debt_entries').delete().eq('month', month).eq('creditor_id', creditor_id).execute()
            else:
                # Insert or update
                payload = {
                    'month': month,
                    'creditor_id': creditor_id,
                    'amount': amount,
                    'amount_paid': 0,
                    'status': 'unpaid',
                }
                # Try update first, then insert if not found
                result = supabase.table('debt_entries').upsert(payload).execute()

        log_change('debt_entries', None, 'upsert', {'month': month})
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debts/<int:id>/pay', methods=['POST'])
def pay_debt(id):
    """POST /api/debts/<id>/pay - record debt payment (partial or full)."""
    data = request.json
    supabase = get_client()

    try:
        # Fetch current entry
        result = supabase.table('debt_entries').select('*').eq('id', id).execute()
        if not result.data:
            return jsonify({'error': 'Debt entry not found'}), 404

        entry = result.data[0]
        amount = float(entry['amount'])

        # Determine new amount_paid
        if data.get('full'):
            new_amount_paid = amount
        else:
            payment = validate_amount(data.get('amount_paid', 0))
            new_amount_paid = min(float(entry['amount_paid']) + payment, amount)

        # Derive status from amount_paid
        if new_amount_paid <= 0:
            status = 'unpaid'
        elif new_amount_paid >= amount:
            status = 'paid'
        else:
            status = 'partial'

        # Update
        payload = {
            'amount_paid': new_amount_paid,
            'status': status,
            'paid_at': datetime.now().isoformat() if status == 'paid' else entry.get('paid_at'),
        }

        update_result = supabase.table('debt_entries').update(payload).eq('id', id).execute()

        if update_result.data:
            log_change('debt_entries', id, 'pay', {'amount_paid': new_amount_paid, 'status': status})
            return jsonify(update_result.data[0])
        else:
            return jsonify({'error': 'Failed to record payment'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/debts/<month>', methods=['DELETE'])
def delete_debt_month(month):
    """DELETE /api/debts/<month> - delete all debt entries for a month."""
    supabase = get_client()

    try:
        supabase.table('debt_entries').delete().eq('month', month).execute()
        log_change('debt_entries', None, 'delete', {'month': month})
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
