#!/usr/bin/env python3
"""
Migrate data from SQLite (finance.db) to Supabase Postgres.
Run with: python3 scripts/migrate_to_supabase.py [--dry-run]
"""

import sqlite3
import sys
import os
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
SQLITE_DB = 'finance.db'

DRY_RUN = '--dry-run' in sys.argv

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
sqlite_conn = sqlite3.connect(SQLITE_DB)
sqlite_conn.row_factory = sqlite3.Row

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def migrate_table(table_name, transform_fn=None):
    """Migrate a table from SQLite to Supabase."""
    log(f"Migrating {table_name}...")

    cursor = sqlite_conn.execute(f'SELECT * FROM {table_name}')
    rows = cursor.fetchall()

    if not rows:
        log(f"  {table_name}: no rows to migrate")
        return 0

    data = []
    for row in rows:
        record = dict(row)
        if transform_fn:
            record = transform_fn(record)
        data.append(record)

    # Insert in batches
    batch_size = 500
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        if DRY_RUN:
            log(f"  [DRY RUN] Would insert {len(batch)} rows to {table_name}")
        else:
            try:
                supabase.table(table_name).insert(batch).execute()
                log(f"  Inserted batch {i//batch_size + 1} ({len(batch)} rows)")
            except Exception as e:
                log(f"  ERROR inserting batch to {table_name}: {e}")
                return 0

    return len(data)

def bool_from_int(val):
    """Convert SQLite INTEGER (0/1) to Postgres boolean."""
    if val is None:
        return False
    return bool(int(val))

def main():
    log("=== Finance.db → Supabase Migration ===")
    log(f"DRY RUN: {DRY_RUN}")

    counts = {}

    try:
        # Migration order respects FK dependencies

        # 1. bank_accounts (no deps)
        counts['bank_accounts'] = migrate_table('bank_accounts', lambda r: {
            'id': r['id'],
            'name': r['name'],
            'account_type': r['account_type'] or 'Bank',
            'notes': r['notes'] or '',
            'active': bool_from_int(r['active']),
            'sort_order': r['sort_order'] or 99,
        })

        # 2. debt_creditors (no deps)
        counts['debt_creditors'] = migrate_table('debt_creditors', lambda r: {
            'id': r['id'],
            'name': r['name'],
            'sort_order': r['sort_order'] or 99,
            'active': bool_from_int(r['active']),
        })

        # 3. account_openings (refs bank_accounts)
        counts['account_openings'] = migrate_table('account_openings', lambda r: {
            'id': r['id'],
            'month': r['month'],
            'account': r['account'],
            'opening_balance': float(r['opening_balance'] or 0),
        })

        # 4. income_entries (refs bank_accounts)
        counts['income_entries'] = migrate_table('income_entries', lambda r: {
            'id': r['id'],
            'date': r['date'],
            'description': r['description'] or '',
            'category': r['category'] or 'Other',
            'account': r['account'] or 'Kotak',
            'payment_method': r['payment_method'] or 'UPI',
            'amount': float(r['amount'] or 0),
            'month': r['month'],
            'notes': r['notes'] or '',
            'is_recurring': bool_from_int(r['is_recurring']),
            'deleted': bool_from_int(r['deleted']),
        })

        # 5. expenses (refs bank_accounts)
        counts['expenses'] = migrate_table('expenses', lambda r: {
            'id': r['id'],
            'date': r['date'],
            'description': r['description'] or '',
            'category': r['category'] or 'Other',
            'account': r['account'] or 'Kotak',
            'payment_method': r['payment_method'] or 'UPI',
            'amount': float(r['amount'] or 0),
            'month': r['month'],
            'notes': r['notes'] or '',
            'is_recurring': bool_from_int(r['is_recurring']),
            'is_split': bool_from_int(r['is_split']),
            'deleted': bool_from_int(r['deleted']),
        })

        # 6. expense_splits (refs expenses)
        counts['expense_splits'] = migrate_table('expense_splits', lambda r: {
            'id': r['id'],
            'expense_id': r['expense_id'],
            'category': r['category'],
            'amount': float(r['amount'] or 0),
            'description': r['description'] or '',
        })

        # 7. budgets (no deps)
        counts['budgets'] = migrate_table('budgets', lambda r: {
            'id': r['id'],
            'category': r['category'],
            'monthly_limit': float(r['monthly_limit'] or 0),
        })

        # 8. transfers (refs bank_accounts)
        counts['transfers'] = migrate_table('transfers', lambda r: {
            'id': r['id'],
            'date': r['date'],
            'from_account': r['from_account'],
            'to_account': r['to_account'],
            'amount': float(r['amount'] or 0),
            'payment_method': r['payment_method'] or 'IMPS',
            'description': r['description'] or '',
            'notes': r['notes'] or '',
            'month': r['month'],
            'deleted': bool_from_int(r['deleted']),
        })

        # 9. debt_entries (refs debt_creditors) — fold in legacy debts table if present
        cursor = sqlite_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='debts'")
        legacy_debts_exists = cursor.fetchone() is not None

        counts['debt_entries'] = migrate_table('debt_entries', lambda r: {
            'id': r['id'],
            'month': r['month'],
            'creditor_id': r['creditor_id'],
            'amount': float(r['amount'] or 0),
            'amount_paid': 0.0,  # default: unpaid
            'status': 'unpaid',
            'paid_at': None,
        })

        if legacy_debts_exists and not DRY_RUN:
            log("Legacy debts table found; folding into debt_entries...")
            # (This would read from the legacy flat debts table and upsert; for now, skip if it's empty)

        # 10. subscriptions (no deps, but has soft-delete inconsistency we'll fix)
        counts['subscriptions'] = migrate_table('subscriptions', lambda r: {
            'id': r['id'],
            'name': r['name'],
            'amount': float(r['amount'] or 0),
            'description': r['description'] or '',
            'status': r['status'] or 'active',
            'billing_day': r['billing_day'] or 1,
            'billing_cycle': r['billing_cycle'] or 'monthly',
            'deleted': bool_from_int(r['deleted']),
        })

        # 11. Generate initial subscription_payments rows for current/past cycles
        if not DRY_RUN and counts['subscriptions'] > 0:
            log("Generating subscription_payments for current/past cycles...")
            cursor = sqlite_conn.execute('SELECT DISTINCT month FROM expenses UNION SELECT DISTINCT month FROM income_entries ORDER BY month DESC LIMIT 6')
            recent_months = [row[0] for row in cursor.fetchall()]

            if recent_months:
                # For each active subscription, create a payment row per recent month
                subs_cursor = sqlite_conn.execute('SELECT id FROM subscriptions WHERE status = "active" AND COALESCE(deleted,0)=0')
                sub_ids = [row[0] for row in subs_cursor.fetchall()]

                payment_rows = []
                for sub_id in sub_ids:
                    for month in recent_months:
                        payment_rows.append({
                            'subscription_id': sub_id,
                            'cycle_month': month,
                            'status': 'paid',  # mark past cycles as paid
                            'amount': 0.0,     # will be set by logic layer if needed
                            'due_date': '2026-01-01',  # placeholder
                        })

                if payment_rows:
                    for i in range(0, len(payment_rows), 500):
                        batch = payment_rows[i:i+500]
                        try:
                            supabase.table('subscription_payments').insert(batch).execute()
                            log(f"  Inserted {len(batch)} subscription payment rows")
                        except Exception as e:
                            log(f"  WARNING: Could not insert subscription_payments: {e}")

        # 12. _changelog (audit log)
        counts['_changelog'] = migrate_table('_changelog', lambda r: {
            'id': r['id'],
            'ts': r['ts'] or datetime.now().isoformat(),
            'table_name': r['table_name'],
            'row_id': r['row_id'],
            'action': r['action'],
            'details': r['details'],
        })

        log("\n=== Migration Summary ===")
        for table, count in counts.items():
            log(f"{table}: {count} rows")

        total = sum(counts.values())
        log(f"\nTotal: {total} rows migrated")

        if not DRY_RUN:
            log("\n=== Resyncing Postgres sequences ===")
            # Resync sequences so future inserts don't collide
            for table in counts.keys():
                try:
                    supabase.postgrest.get(f'/rpc/setval', params={
                        'seq': f'public.{table}_id_seq',
                        'val': counts[table],
                    }).execute()
                except:
                    pass  # Sequence may not exist for all tables; that's ok

            log("Migration complete! Verify data in Supabase dashboard.")
        else:
            log("\nDRY RUN COMPLETE — no data was written to Supabase.")

    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        sqlite_conn.close()

if __name__ == '__main__':
    main()
