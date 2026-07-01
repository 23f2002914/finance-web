"""Import/export API endpoints."""
from flask import Blueprint, request, jsonify, send_file
import json
import csv
import io
from backend.db import get_client

bp = Blueprint('import_export', __name__, url_prefix='/api')

@bp.route('/export/json', methods=['GET'])
def export_json():
    """GET /api/export/json - export all data as JSON."""
    supabase = get_client()

    try:
        tables = [
            'bank_accounts', 'account_openings', 'debt_creditors', 'debt_entries',
            'income_entries', 'expenses', 'expense_splits', 'budgets', 'transfers',
            'subscriptions', 'subscription_payments', '_changelog'
        ]

        export_data = {}
        for table in tables:
            rows = supabase.table(table).select('*').execute()
            export_data[table] = rows.data

        # Convert to JSON-serializable format
        json_str = json.dumps(export_data, indent=2, default=str)

        return send_file(
            io.BytesIO(json_str.encode()),
            mimetype='application/json',
            as_attachment=True,
            download_name='finance_export.json'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/export/csv', methods=['GET'])
def export_csv():
    """GET /api/export/csv?type=expenses - export as CSV."""
    supabase = get_client()
    export_type = request.args.get('type', 'expenses')

    try:
        if export_type == 'expenses':
            rows = supabase.table('expenses').select('*').eq('deleted', False).execute()
            table_name = 'expenses'
        elif export_type == 'income':
            rows = supabase.table('income_entries').select('*').eq('deleted', False).execute()
            table_name = 'income'
        elif export_type == 'transfers':
            rows = supabase.table('transfers').select('*').eq('deleted', False).execute()
            table_name = 'transfers'
        else:
            return jsonify({'error': 'Invalid type'}), 400

        if not rows.data:
            return jsonify({'error': 'No data to export'}), 404

        # Convert to CSV
        output = io.StringIO()
        fieldnames = rows.data[0].keys()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows.data)

        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'{table_name}_export.csv'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/import/expenses', methods=['POST'])
def import_expenses():
    """POST /api/import/expenses - bulk import expenses from CSV."""
    supabase = get_client()

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        reader = csv.DictReader(file.stream.read().decode('utf-8').splitlines())

        from backend.services.dates import date_to_month
        from backend.services.validators import validate_amount

        imported = 0
        for row in reader:
            date = row.get('date')
            month = date_to_month(date)

            payload = {
                'date': date,
                'description': row.get('description', ''),
                'category': row.get('category', 'Other'),
                'account': row.get('account', 'Kotak'),
                'payment_method': row.get('payment_method', 'UPI'),
                'amount': validate_amount(row.get('amount', 0)),
                'month': month,
                'notes': row.get('notes', ''),
                'is_recurring': row.get('is_recurring', 'false').lower() == 'true',
                'deleted': False,
            }

            try:
                supabase.table('expenses').insert(payload).execute()
                imported += 1
            except Exception as e:
                print(f"Warning: Failed to import row: {e}")

        return jsonify({'imported': imported})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/import/income', methods=['POST'])
def import_income():
    """POST /api/import/income - bulk import income from CSV."""
    supabase = get_client()

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        reader = csv.DictReader(file.stream.read().decode('utf-8').splitlines())

        from backend.services.dates import date_to_month
        from backend.services.validators import validate_amount

        imported = 0
        for row in reader:
            date = row.get('date')
            month = date_to_month(date)

            payload = {
                'date': date,
                'description': row.get('description', ''),
                'category': row.get('category', 'Other'),
                'account': row.get('account', 'Kotak'),
                'payment_method': row.get('payment_method', 'UPI'),
                'amount': validate_amount(row.get('amount', 0)),
                'month': month,
                'notes': row.get('notes', ''),
                'is_recurring': row.get('is_recurring', 'false').lower() == 'true',
                'deleted': False,
            }

            try:
                supabase.table('income_entries').insert(payload).execute()
                imported += 1
            except Exception as e:
                print(f"Warning: Failed to import row: {e}")

        return jsonify({'imported': imported})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
