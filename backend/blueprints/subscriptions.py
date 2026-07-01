"""Subscriptions API endpoints (with payment cycle tracking)."""
from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from backend.db import get_client
from backend.services.audit import log_change
from backend.services.validators import validate_amount

bp = Blueprint('subscriptions', __name__, url_prefix='/api')

@bp.route('/subscriptions', methods=['GET'])
def list_subscriptions():
    """GET /api/subscriptions - list all subscriptions with payment cycle status."""
    supabase = get_client()

    try:
        # Call subscription_cycle_status() RPC to flip any past-due cycles to overdue
        supabase.rpc('subscription_cycle_status').execute()

        # Fetch subscriptions
        subs = supabase.table('subscriptions').select('*').eq('deleted', False).order('name').execute()

        result = []
        for sub in subs.data:
            # Get payment history
            payments = supabase.table('subscription_payments').select('*').eq('subscription_id', sub['id']).order('cycle_month', desc=True).execute()

            # Compute monthly equivalent
            amount = float(sub['amount'])
            if sub['billing_cycle'] == 'annual':
                monthly_equiv = amount / 12
            else:
                monthly_equiv = amount

            # Find current/next cycle
            current_cycle = None
            if payments.data:
                current_cycle = payments.data[0]

            result.append({
                'id': sub['id'],
                'name': sub['name'],
                'amount': amount,
                'description': sub['description'],
                'status': sub['status'],
                'billing_day': sub['billing_day'],
                'billing_cycle': sub['billing_cycle'],
                'monthly_equiv': monthly_equiv,
                'current_cycle': current_cycle,
                'deleted': sub['deleted'],
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/subscriptions', methods=['POST'])
def create_subscription():
    """POST /api/subscriptions - create subscription."""
    data = request.json
    supabase = get_client()

    try:
        payload = {
            'name': data.get('name'),
            'amount': validate_amount(data.get('amount', 0)),
            'description': data.get('description', ''),
            'status': 'active',
            'billing_day': data.get('billing_day', 1),
            'billing_cycle': data.get('billing_cycle', 'monthly'),
            'deleted': False,
        }

        result = supabase.table('subscriptions').insert(payload).execute()

        if result.data:
            sub_id = result.data[0]['id']
            log_change('subscriptions', sub_id, 'create', {'name': payload['name']})

            # Create initial payment cycle for current month
            today = date.today()
            current_month = today.strftime('%b %Y')
            due_date = today.replace(day=min(payload['billing_day'], 28))

            payment_payload = {
                'subscription_id': sub_id,
                'cycle_month': current_month,
                'status': 'due' if due_date >= today else 'overdue',
                'amount': payload['amount'],
                'due_date': due_date.isoformat(),
            }
            supabase.table('subscription_payments').insert(payment_payload).execute()

            return jsonify(result.data[0]), 201
        else:
            return jsonify({'error': 'Failed to create subscription'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/subscriptions/<int:id>', methods=['PUT'])
def update_subscription(id):
    """PUT /api/subscriptions/<id> - update subscription."""
    data = request.json
    supabase = get_client()

    try:
        payload = {}
        if 'name' in data:
            payload['name'] = data['name']
        if 'amount' in data:
            payload['amount'] = validate_amount(data['amount'])
        if 'description' in data:
            payload['description'] = data['description']
        if 'status' in data:
            payload['status'] = data['status']
        if 'billing_day' in data:
            payload['billing_day'] = data['billing_day']
        if 'billing_cycle' in data:
            payload['billing_cycle'] = data['billing_cycle']

        result = supabase.table('subscriptions').update(payload).eq('id', id).execute()

        if result.data:
            log_change('subscriptions', id, 'update', payload)
            return jsonify(result.data[0])
        else:
            return jsonify({'error': 'Subscription not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/subscriptions/<int:id>', methods=['DELETE'])
def delete_subscription(id):
    """DELETE /api/subscriptions/<id> - soft delete subscription."""
    supabase = get_client()

    try:
        supabase.table('subscriptions').update({'deleted': True}).eq('id', id).execute()
        log_change('subscriptions', id, 'delete')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============= Subscription Payment Cycles =============

@bp.route('/subscriptions/<int:id>/payments', methods=['GET'])
def list_subscription_payments(id):
    """GET /api/subscriptions/<id>/payments - list payment cycles for subscription."""
    supabase = get_client()

    try:
        # Ensure current cycle exists
        supabase.rpc('subscription_cycle_status').execute()

        payments = supabase.table('subscription_payments').select('*').eq('subscription_id', id).order('cycle_month', desc=True).execute()
        return jsonify(payments.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/subscriptions/<int:id>/payments/ensure-cycle', methods=['POST'])
def ensure_subscription_cycle(id):
    """POST /api/subscriptions/<id>/payments/ensure-cycle - create current cycle if missing."""
    data = request.json
    supabase = get_client()

    try:
        cycle_month = data.get('cycle_month')  # e.g., 'Jul 2026'

        # Check if cycle already exists
        existing = supabase.table('subscription_payments').select('id').eq('subscription_id', id).eq('cycle_month', cycle_month).execute()
        if existing.data:
            return jsonify({'ok': True, 'existing': True})

        # Fetch subscription to get amount and billing_day
        sub = supabase.table('subscriptions').select('*').eq('id', id).execute()
        if not sub.data:
            return jsonify({'error': 'Subscription not found'}), 404

        subscription = sub.data[0]

        # Compute due_date from billing_day and cycle_month
        from datetime import datetime as dt
        month_date = dt.strptime(cycle_month, '%b %Y')
        due_day = min(subscription['billing_day'], 28)
        due_date = month_date.replace(day=due_day)

        # Determine initial status
        today = date.today()
        if due_date.date() < today:
            status = 'overdue'
        else:
            status = 'due'

        payload = {
            'subscription_id': id,
            'cycle_month': cycle_month,
            'status': status,
            'amount': subscription['amount'],
            'due_date': due_date.date().isoformat(),
        }

        result = supabase.table('subscription_payments').insert(payload).execute()

        if result.data:
            log_change('subscription_payments', result.data[0]['id'], 'create', {'cycle': cycle_month})
            return jsonify({'ok': True, 'existing': False})
        else:
            return jsonify({'error': 'Failed to create cycle'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/subscriptions/<int:id>/payments/<cycle_month>/pay', methods=['POST'])
def pay_subscription_cycle(id, cycle_month):
    """POST /api/subscriptions/<id>/payments/<cycle_month>/pay - mark cycle as paid."""
    supabase = get_client()

    try:
        # Fetch the payment cycle
        result = supabase.table('subscription_payments').select('*').eq('subscription_id', id).eq('cycle_month', cycle_month).execute()
        if not result.data:
            return jsonify({'error': 'Payment cycle not found'}), 404

        payment = result.data[0]

        # Mark as paid
        update_result = supabase.table('subscription_payments').update({
            'status': 'paid',
            'paid_date': date.today().isoformat(),
        }).eq('id', payment['id']).execute()

        if update_result.data:
            log_change('subscription_payments', payment['id'], 'pay', {'cycle': cycle_month})
            return jsonify(update_result.data[0])
        else:
            return jsonify({'error': 'Failed to mark as paid'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500
