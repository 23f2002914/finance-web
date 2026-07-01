from flask import Flask, jsonify, request, render_template, session, send_file
import sqlite3, os, json as _json
from datetime import datetime
from functools import wraps
import config

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
DB = config.DB_PATH

INC_CATS    = ['Rental','Refund','Salary','Freelance','Gift','Interest','Other']
EXP_CATS    = ['Food & Dining','Transport','Shopping','Entertainment',
               'Health & Medical','Education','Utilities','Personal Care','Other']
PAY_METHODS = ['UPI','Card - Debit','Card - Credit','Cash','Net Banking','Cheque']
ACCT_TYPES  = ['Bank','Wallet','Cash']

# ── HELPERS ───────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def month_key(m):
    try: return datetime.strptime(m, '%b %Y').strftime('%Y%m')
    except: return '000000'

def date_to_month(d):
    return datetime.strptime(d, '%Y-%m-%d').strftime('%b %Y')

def sub_total(conn):
    rows = conn.execute("SELECT amount,billing_cycle FROM subscriptions WHERE status='active' AND COALESCE(deleted,0)=0").fetchall()
    total = 0
    for r in rows:
        total += (r['amount']/12) if r['billing_cycle']=='annual' else r['amount']
    return round(total, 2)

def get_accounts(conn):
    return [r['name'] for r in conn.execute(
        "SELECT name FROM bank_accounts WHERE active=1 ORDER BY sort_order,name").fetchall()]

def acc_summary(conn, month=None):
    accounts = get_accounts(conn)
    result   = {}
    for acc in accounts:
        if month:
            row     = conn.execute('SELECT opening_balance FROM account_openings WHERE month=? AND account=?',(month,acc)).fetchone()
            opening = row[0] if row else 0
            inc     = conn.execute('SELECT COALESCE(SUM(amount),0) FROM income_entries WHERE month=? AND account=? AND COALESCE(deleted,0)=0',(month,acc)).fetchone()[0]
            exp     = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses       WHERE month=? AND account=? AND COALESCE(deleted,0)=0',(month,acc)).fetchone()[0]
            t_in    = conn.execute('SELECT COALESCE(SUM(amount),0) FROM transfers WHERE month=? AND to_account=?   AND COALESCE(deleted,0)=0',(month,acc)).fetchone()[0]
            t_out   = conn.execute('SELECT COALESCE(SUM(amount),0) FROM transfers WHERE month=? AND from_account=? AND COALESCE(deleted,0)=0',(month,acc)).fetchone()[0]
        else:
            all_ops = conn.execute('SELECT month,opening_balance FROM account_openings WHERE account=?',(acc,)).fetchall()
            opening = min(all_ops, key=lambda r: month_key(r[0]))[1] if all_ops else 0
            inc     = conn.execute('SELECT COALESCE(SUM(amount),0) FROM income_entries WHERE account=? AND COALESCE(deleted,0)=0',(acc,)).fetchone()[0]
            exp     = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses       WHERE account=? AND COALESCE(deleted,0)=0',(acc,)).fetchone()[0]
            t_in    = conn.execute('SELECT COALESCE(SUM(amount),0) FROM transfers WHERE to_account=?   AND COALESCE(deleted,0)=0',(acc,)).fetchone()[0]
            t_out   = conn.execute('SELECT COALESCE(SUM(amount),0) FROM transfers WHERE from_account=? AND COALESCE(deleted,0)=0',(acc,)).fetchone()[0]
        result[acc] = {'opening':round(opening,2),'income':round(inc,2),
                       'transfers_in':round(t_in,2),'transfers_out':round(t_out,2),
                       'expenses':round(exp,2),'closing':round(opening+inc+t_in-exp-t_out,2)}
    return result

def log_change(conn, table, row_id, action, details=None):
    conn.execute('INSERT INTO _changelog(table_name,row_id,action,details) VALUES(?,?,?,?)',
                 (table, row_id, action, _json.dumps(details) if details else None))

def validate_amount(d):
    amt = d.get('amount', 0)
    try: amt = float(amt)
    except: return 'Amount must be a number'
    if amt <= 0: return 'Amount must be greater than 0'
    return None

# ── AUTH ──────────────────────────────────────────────────────────────────────
@app.before_request
def check_auth():
    if not config.PASSWORD: return
    if request.path in ('/', ) or request.path.startswith('/static'): return
    if request.path.startswith('/api/auth'): return
    if not session.get('logged_in'):
        return jsonify({'error':'Unauthorized','auth_required':True}), 401

@app.route('/api/auth/status')
def auth_status():
    return jsonify({'auth_required': bool(config.PASSWORD),
                    'logged_in':     session.get('logged_in', False)})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    d = request.json or {}
    if not config.PASSWORD or d.get('password') == config.PASSWORD:
        session['logged_in'] = True
        return jsonify({'ok': True})
    return jsonify({'error': 'Wrong password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'ok': True})

# ── ERROR HANDLERS ────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return render_template('index.html')

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error('Unhandled exception: %s', e, exc_info=True)
    return jsonify({'error': str(e)}), 500

# ── INIT DB ───────────────────────────────────────────────────────────────────
def init_db():
    conn = get_db(); c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            account_type TEXT DEFAULT 'Bank',
            notes TEXT DEFAULT '',
            active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 99
        );
        CREATE TABLE IF NOT EXISTS account_openings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL,
            account TEXT NOT NULL,
            opening_balance REAL DEFAULT 0,
            UNIQUE(month, account)
        );
        CREATE TABLE IF NOT EXISTS debts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL UNIQUE,
            snapmint REAL DEFAULT 0, ani REAL DEFAULT 0,
            abul_suri REAL DEFAULT 0, studcred REAL DEFAULT 0, other REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS income_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT DEFAULT 'Other', account TEXT DEFAULT 'Kotak',
            payment_method TEXT DEFAULT 'UPI',
            amount REAL NOT NULL DEFAULT 0, month TEXT NOT NULL, notes TEXT DEFAULT '',
            is_recurring INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
            description TEXT DEFAULT '', status TEXT DEFAULT 'active',
            billing_day INTEGER DEFAULT 1, billing_cycle TEXT DEFAULT 'monthly',
            deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL, description TEXT DEFAULT '',
            category TEXT DEFAULT 'Other', account TEXT DEFAULT 'Kotak',
            payment_method TEXT DEFAULT 'UPI',
            amount REAL NOT NULL DEFAULT 0, month TEXT NOT NULL, notes TEXT DEFAULT '',
            is_recurring INTEGER DEFAULT 0, is_split INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS expense_splits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_id INTEGER NOT NULL,
            category TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
            description TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE,
            monthly_limit REAL NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL, from_account TEXT NOT NULL, to_account TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0, payment_method TEXT DEFAULT 'IMPS',
            description TEXT DEFAULT '', notes TEXT DEFAULT '',
            month TEXT NOT NULL, deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS _seeded (key TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS _changelog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT DEFAULT (datetime('now','localtime')),
            table_name TEXT, row_id INTEGER, action TEXT, details TEXT
        );
        CREATE TABLE IF NOT EXISTS debt_creditors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER DEFAULT 99,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS debt_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL,
            creditor_id INTEGER NOT NULL REFERENCES debt_creditors(id),
            amount REAL DEFAULT 0,
            UNIQUE(month, creditor_id)
        );

        CREATE INDEX IF NOT EXISTS idx_splits_eid  ON expense_splits(expense_id);
    ''')

    # Safe column additions (backward compat)
    safe_alters = [
        ('expenses',       'payment_method', "TEXT DEFAULT 'UPI'"),
        ('expenses',       'is_recurring',   'INTEGER DEFAULT 0'),
        ('expenses',       'is_split',       'INTEGER DEFAULT 0'),
        ('expenses',       'deleted',        'INTEGER DEFAULT 0'),
        ('income_entries', 'payment_method', "TEXT DEFAULT 'UPI'"),
        ('income_entries', 'is_recurring',   'INTEGER DEFAULT 0'),
        ('income_entries', 'deleted',        'INTEGER DEFAULT 0'),
        ('transfers',      'deleted',        'INTEGER DEFAULT 0'),
        ('subscriptions',  'billing_day',    'INTEGER DEFAULT 1'),
        ('subscriptions',  'billing_cycle',  "TEXT DEFAULT 'monthly'"),
        ('subscriptions',  'deleted',        'INTEGER DEFAULT 0'),
    ]
    for tbl, col, defn in safe_alters:
        cols = [r[1] for r in c.execute(f'PRAGMA table_info({tbl})').fetchall()]
        if col not in cols:
            c.execute(f'ALTER TABLE {tbl} ADD COLUMN {col} {defn}')

    # Indexes (created after safe_alters so deleted columns exist on old DBs)
    c.executescript('''
        CREATE INDEX IF NOT EXISTS idx_exp_month   ON expenses(month);
        CREATE INDEX IF NOT EXISTS idx_exp_del     ON expenses(deleted);
        CREATE INDEX IF NOT EXISTS idx_inc_month   ON income_entries(month);
        CREATE INDEX IF NOT EXISTS idx_inc_del     ON income_entries(deleted);
        CREATE INDEX IF NOT EXISTS idx_tr_month    ON transfers(month);
        CREATE INDEX IF NOT EXISTS idx_tr_del      ON transfers(deleted);
        CREATE INDEX IF NOT EXISTS idx_de_month    ON debt_entries(month);
        CREATE INDEX IF NOT EXISTS idx_de_creditor ON debt_entries(creditor_id);
    ''')

    # Migrate old schemas
    if c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='income_opening'").fetchone():
        for row in c.execute('SELECT * FROM income_opening').fetchall():
            row = dict(row)
            for acc, col in [('Kotak','kotak_opening'),('HDFC','hdfc_opening'),('Slice','slice_opening')]:
                if row.get(col,0):
                    c.execute('INSERT OR IGNORE INTO account_openings(month,account,opening_balance) VALUES(?,?,?)',
                              (row['month'], acc, row[col]))
    if c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='income'").fetchone():
        for row in c.execute('SELECT * FROM income').fetchall():
            row = dict(row)
            for cat, field in [('Rental','rental'),('Refund','refunds')]:
                if row.get(field,0) and not c.execute(
                        'SELECT 1 FROM income_entries WHERE month=? AND category=?',(row['month'],cat)).fetchone():
                    c.execute('INSERT INTO income_entries(date,description,category,account,payment_method,amount,month) VALUES(?,?,?,?,?,?,?)',
                              (row['month'].split()[0]+'-01-2026', cat+' income', cat, 'Kotak','UPI',row[field],row['month']))

    def seeded(key): return c.execute('SELECT 1 FROM _seeded WHERE key=?',(key,)).fetchone()
    def mark(key):   c.execute('INSERT OR IGNORE INTO _seeded(key) VALUES(?)',(key,))

    if not seeded('bank_accounts'):
        c.executemany('INSERT OR IGNORE INTO bank_accounts(name,account_type,sort_order) VALUES(?,?,?)',
                      [('Kotak','Bank',1),('HDFC','Bank',2),('Slice','Bank',3),('Cash','Cash',4)])
        mark('bank_accounts')
    if not seeded('subscriptions'):
        c.executemany('INSERT INTO subscriptions(name,amount,description,billing_day,billing_cycle) VALUES(?,?,?,?,?)',
                      [('Claude',1000,'AI assistant',1,'monthly'),
                       ('Spotify',69,'Music streaming',1,'monthly'),
                       ('YouTube Premium',89,'Video streaming',1,'monthly')])
        mark('subscriptions')
    if not seeded('debt_creditors'):
        c.executemany('INSERT OR IGNORE INTO debt_creditors(name,sort_order) VALUES(?,?)',
                      [('Snapmint',1),('Ani',2),('Abul Suri',3),('StudCred',4),('Other',5)])
        mark('debt_creditors')
    # Migrate old debts table → debt_entries (existing DBs with data only)
    old_debts_exist = c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='debts'").fetchone()
    if old_debts_exist and not seeded('debt_migration'):
        old_rows = c.execute('SELECT COUNT(*) FROM debts').fetchone()[0]
        if old_rows:
            col_to_name = {'snapmint':'Snapmint','ani':'Ani','abul_suri':'Abul Suri','studcred':'StudCred','other':'Other'}
            for name, order in [('Snapmint',1),('Ani',2),('Abul Suri',3),('StudCred',4),('Other',5)]:
                c.execute('INSERT OR IGNORE INTO debt_creditors(name,sort_order) VALUES(?,?)',(name,order))
            cred_ids = {r[0]:r[1] for r in c.execute('SELECT name,id FROM debt_creditors').fetchall()}
            for row in c.execute('SELECT * FROM debts').fetchall():
                row = dict(row)
                for col, name in col_to_name.items():
                    amt = row.get(col,0) or 0
                    if amt and name in cred_ids:
                        c.execute('INSERT OR IGNORE INTO debt_entries(month,creditor_id,amount) VALUES(?,?,?)',
                                  (row['month'],cred_ids[name],amt))
            mark('debt_migration')
    if not seeded('debt_entries') and not seeded('debt_migration'):
        cred_ids = {r[0]:r[1] for r in c.execute('SELECT name,id FROM debt_creditors').fetchall()}
        sample = [
            ('Jul 2026','Snapmint',1319),('Jul 2026','Ani',500),('Jul 2026','Abul Suri',500),('Jul 2026','StudCred',261.12),
            ('Aug 2026','Snapmint',1136),('Aug 2026','Ani',500),('Aug 2026','Abul Suri',500),('Aug 2026','StudCred',1157.87),
            ('Sep 2026','Snapmint',1049),('Sep 2026','Ani',500),('Sep 2026','Abul Suri',500),('Sep 2026','StudCred',1500),
            ('Oct 2026','Snapmint',96),('Oct 2026','Ani',400),('Oct 2026','Abul Suri',500),
            ('Nov 2026','Snapmint',96),
        ]
        for month, name, amt in sample:
            cid = cred_ids.get(name)
            if cid: c.execute('INSERT OR IGNORE INTO debt_entries(month,creditor_id,amount) VALUES(?,?,?)',(month,cid,amt))
        mark('debt_entries')
    if not seeded('account_openings'):
        c.execute('INSERT OR IGNORE INTO account_openings(month,account,opening_balance) VALUES(?,?,?)',('Jul 2026','Kotak',214.77))
        c.execute('INSERT OR IGNORE INTO account_openings(month,account,opening_balance) VALUES(?,?,?)',('Jul 2026','HDFC',21))
        c.execute('INSERT OR IGNORE INTO account_openings(month,account,opening_balance) VALUES(?,?,?)',('Jul 2026','Slice',163.65))
        mark('account_openings')
    if not seeded('income_entries'):
        c.executemany('INSERT INTO income_entries(date,description,category,account,payment_method,amount,month,notes) VALUES(?,?,?,?,?,?,?,?)',
                      [('2026-07-01','Rental income','Rental','Kotak','UPI',10000,'Jul 2026',''),
                       ('2026-07-15','Amazon refund','Refund','Kotak','UPI',7904.15,'Jul 2026','')])
        mark('income_entries')
    if not seeded('expenses'):
        c.executemany('INSERT INTO expenses(date,description,category,account,payment_method,amount,month,notes) VALUES(?,?,?,?,?,?,?,?)',
                      [('2026-07-05','Groceries','Food & Dining','Kotak','UPI',450,'Jul 2026',''),
                       ('2026-07-08','Uber to campus','Transport','Slice','UPI',120,'Jul 2026',''),
                       ('2026-07-12','Amazon purchase','Shopping','HDFC','Card - Debit',899,'Jul 2026','Phone case'),
                       ('2026-07-20','Pharmacy','Health & Medical','Kotak','Cash',230,'Jul 2026','')])
        mark('expenses')

    conn.commit(); conn.close()

# ── MAIN ──────────────────────────────────────────────────────────────────────
@app.route('/')
def index(): return render_template('index.html')

# ── BACKUP / EXPORT ───────────────────────────────────────────────────────────
@app.route('/api/backup')
def backup():
    return send_file(DB, as_attachment=True,
                     download_name=f'finance-backup-{datetime.today().strftime("%Y%m%d")}.db',
                     mimetype='application/octet-stream')

@app.route('/api/export/json')
def export_json():
    conn = get_db()
    tables = ['bank_accounts','account_openings','income_entries','expenses',
              'expense_splits','transfers','debt_creditors','debt_entries','subscriptions','budgets']
    data = {}
    for t in tables:
        data[t] = [dict(r) for r in conn.execute(f'SELECT * FROM {t}').fetchall()]
    conn.close()
    out = _json.dumps(data, indent=2, ensure_ascii=False)
    from flask import Response
    return Response(out, mimetype='application/json',
                    headers={'Content-Disposition':
                             f'attachment; filename=finance-export-{datetime.today().strftime("%Y%m%d")}.json'})

@app.route('/api/export/csv')
def export_csv():
    import csv, io
    kind = request.args.get('type','expenses')
    table_map = {'expenses':'expenses','income':'income_entries','transfers':'transfers'}
    tbl = table_map.get(kind,'expenses')
    conn = get_db()
    rows = [dict(r) for r in conn.execute(f'SELECT * FROM {tbl} WHERE COALESCE(deleted,0)=0 ORDER BY date DESC').fetchall()]
    conn.close()
    if not rows: return jsonify({'error':'No data'}),404
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
    from flask import Response
    return Response(buf.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition':
                             f'attachment; filename={kind}-{datetime.today().strftime("%Y%m%d")}.csv'})

# ── AUDIT LOG ─────────────────────────────────────────────────────────────────
@app.route('/api/changelog')
def get_changelog():
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        'SELECT * FROM _changelog ORDER BY id DESC LIMIT 200').fetchall()]
    conn.close(); return jsonify(rows)

# ── BANK ACCOUNTS ─────────────────────────────────────────────────────────────
@app.route('/api/accounts', methods=['GET'])
def get_accounts_api():
    conn = get_db()
    rows = [dict(r) for r in conn.execute('SELECT * FROM bank_accounts ORDER BY sort_order,name').fetchall()]
    s = acc_summary(conn)
    for r in rows: r['closing_balance'] = s.get(r['name'],{}).get('closing',0)
    conn.close(); return jsonify(rows)

@app.route('/api/accounts/list', methods=['GET'])
def list_accounts():
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        "SELECT name,account_type FROM bank_accounts WHERE active=1 ORDER BY sort_order,name").fetchall()]
    conn.close(); return jsonify(rows)

@app.route('/api/accounts', methods=['POST'])
def add_account():
    d = request.json; conn = get_db()
    try:
        cur = conn.execute('INSERT INTO bank_accounts(name,account_type,notes,sort_order) VALUES(?,?,?,?)',
                           (d['name'].strip(),d.get('account_type','Bank'),d.get('notes',''),d.get('sort_order',99)))
        log_change(conn,'bank_accounts',cur.lastrowid,'create',{'name':d['name']})
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'error':f"Account '{d['name']}' already exists"}),400
    conn.close(); return jsonify({'ok':True}),201

@app.route('/api/accounts/<int:id>', methods=['PUT'])
def update_account(id):
    d = request.json; conn = get_db()
    old = conn.execute('SELECT name FROM bank_accounts WHERE id=?',(id,)).fetchone()
    old_name = old['name'] if old else None
    new_name = d['name'].strip()
    conn.execute('UPDATE bank_accounts SET name=?,account_type=?,notes=?,active=?,sort_order=? WHERE id=?',
                 (new_name,d.get('account_type','Bank'),d.get('notes',''),
                  1 if d.get('active',True) else 0,d.get('sort_order',99),id))
    # Cascade rename to all transaction tables
    if old_name and old_name != new_name:
        for tbl,col in [('expenses','account'),('income_entries','account'),
                        ('account_openings','account'),
                        ('transfers','from_account'),('transfers','to_account')]:
            conn.execute(f'UPDATE {tbl} SET {col}=? WHERE {col}=?',(new_name,old_name))
        log_change(conn,'bank_accounts',id,'rename',{'from':old_name,'to':new_name})
    else:
        log_change(conn,'bank_accounts',id,'update',{'name':new_name})
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/accounts/<int:id>', methods=['DELETE'])
def delete_account(id):
    conn = get_db()
    conn.execute('DELETE FROM bank_accounts WHERE id=?',(id,))
    log_change(conn,'bank_accounts',id,'delete')
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── ACCOUNT OPENINGS ──────────────────────────────────────────────────────────
@app.route('/api/account-openings', methods=['GET'])
def get_account_openings():
    conn = get_db()
    months = sorted(set(r[0] for r in conn.execute('SELECT DISTINCT month FROM account_openings').fetchall()), key=month_key)
    result = []
    for m in months:
        rows = conn.execute('SELECT * FROM account_openings WHERE month=? ORDER BY account',(m,)).fetchall()
        entries = []
        for r in rows:
            r = dict(r)
            inc = conn.execute('SELECT COALESCE(SUM(amount),0) FROM income_entries WHERE month=? AND account=? AND COALESCE(deleted,0)=0',(m,r['account'])).fetchone()[0]
            exp = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE month=? AND account=? AND COALESCE(deleted,0)=0',(m,r['account'])).fetchone()[0]
            r['income']  = round(inc,2); r['expenses'] = round(exp,2)
            r['closing'] = round(r['opening_balance']+inc-exp,2)
            entries.append(r)
        result.append({'month':m,'accounts':entries})
    conn.close(); return jsonify(result)

@app.route('/api/account-openings', methods=['POST'])
def add_account_opening():
    d = request.json; conn = get_db()
    try:
        conn.execute('INSERT INTO account_openings(month,account,opening_balance) VALUES(?,?,?)',
                     (d['month'],d['account'],d.get('opening_balance',0)))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'error':f"Opening for {d['account']} in {d['month']} already exists"}),400
    conn.close(); return jsonify({'ok':True}),201

@app.route('/api/account-openings/<int:id>', methods=['PUT'])
def update_account_opening(id):
    d = request.json; conn = get_db()
    conn.execute('UPDATE account_openings SET month=?,account=?,opening_balance=? WHERE id=?',
                 (d['month'],d['account'],d.get('opening_balance',0),id))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/account-openings/<int:id>', methods=['DELETE'])
def delete_account_opening(id):
    conn = get_db(); conn.execute('DELETE FROM account_openings WHERE id=?',(id,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── DEBT CREDITORS ────────────────────────────────────────────────────────────
@app.route('/api/debt-creditors', methods=['GET'])
def get_debt_creditors():
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        'SELECT * FROM debt_creditors ORDER BY sort_order, name').fetchall()]
    conn.close(); return jsonify(rows)

@app.route('/api/debt-creditors', methods=['POST'])
def add_debt_creditor():
    d = request.json; conn = get_db()
    name = (d.get('name') or '').strip()
    if not name: conn.close(); return jsonify({'error':'Name is required'}),400
    try:
        cur = conn.execute('INSERT INTO debt_creditors(name,sort_order) VALUES(?,?)',
                           (name, d.get('sort_order',99)))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'error':f"Creditor '{name}' already exists"}),400
    conn.close(); return jsonify({'ok':True,'id':cur.lastrowid}),201

@app.route('/api/debt-creditors/<int:id>', methods=['PUT'])
def update_debt_creditor(id):
    d = request.json; conn = get_db()
    name = (d.get('name') or '').strip()
    if not name: conn.close(); return jsonify({'error':'Name is required'}),400
    try:
        conn.execute('UPDATE debt_creditors SET name=?,sort_order=?,active=? WHERE id=?',
                     (name, d.get('sort_order',99), 1 if d.get('active',True) else 0, id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'error':f"Creditor '{name}' already exists"}),400
    conn.close(); return jsonify({'ok':True})

@app.route('/api/debt-creditors/<int:id>', methods=['DELETE'])
def delete_debt_creditor(id):
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM debt_entries WHERE creditor_id=?',(id,)).fetchone()[0]
    if count:
        conn.close(); return jsonify({'error':'Cannot delete: creditor has existing debt entries'}),400
    conn.execute('DELETE FROM debt_creditors WHERE id=?',(id,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── DEBTS ─────────────────────────────────────────────────────────────────────
@app.route('/api/debts', methods=['GET'])
def get_debts():
    conn = get_db(); st = sub_total(conn)
    creditors = [dict(r) for r in conn.execute(
        'SELECT * FROM debt_creditors WHERE active=1 ORDER BY sort_order, name').fetchall()]
    months = sorted([r[0] for r in conn.execute(
        'SELECT DISTINCT month FROM debt_entries').fetchall()], key=month_key)
    rows = []
    for m in months:
        entry_map = {r[0]:r[1] for r in conn.execute(
            'SELECT creditor_id,amount FROM debt_entries WHERE month=?',(m,)).fetchall()}
        entries = [{'creditor_id':c['id'],'name':c['name'],
                    'amount':round(entry_map.get(c['id'],0),2)} for c in creditors]
        debt_sum = sum(e['amount'] for e in entries)
        rows.append({'month':m,'entries':entries,'subscriptions':round(st,2),
                     'total':round(debt_sum+st,2)})
    conn.close(); return jsonify({'creditors':creditors,'rows':rows})

@app.route('/api/debts/history', methods=['GET'])
def get_debts_history():
    conn = get_db()
    creditors = [dict(r) for r in conn.execute(
        'SELECT * FROM debt_creditors WHERE active=1 ORDER BY sort_order, name').fetchall()]
    months = sorted([r[0] for r in conn.execute(
        'SELECT DISTINCT month FROM debt_entries').fetchall()], key=month_key)
    series = {}
    for c in creditors:
        amounts = []
        for m in months:
            row = conn.execute('SELECT amount FROM debt_entries WHERE month=? AND creditor_id=?',
                               (m,c['id'])).fetchone()
            amounts.append(row[0] if row else 0)
        series[c['name']] = amounts
    conn.close(); return jsonify({'months':months,'series':series})

@app.route('/api/debts', methods=['POST'])
def upsert_debt():
    d = request.json; conn = get_db()
    month = (d.get('month') or '').strip()
    if not month: conn.close(); return jsonify({'error':'Month is required'}),400
    for e in d.get('entries',[]):
        amt = e.get('amount',0) or 0
        if amt:
            conn.execute('INSERT OR REPLACE INTO debt_entries(month,creditor_id,amount) VALUES(?,?,?)',
                         (month, e['creditor_id'], amt))
        else:
            conn.execute('DELETE FROM debt_entries WHERE month=? AND creditor_id=?',
                         (month, e['creditor_id']))
    conn.commit(); conn.close(); return jsonify({'ok':True}),201

@app.route('/api/debts/<path:month>', methods=['DELETE'])
def delete_debt(month):
    conn = get_db()
    conn.execute('DELETE FROM debt_entries WHERE month=?',(month,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── INCOME ENTRIES ────────────────────────────────────────────────────────────
def _inc_query(conn, args):
    month=args.get('month',''); search=args.get('search','').strip()
    account=args.get('account',''); category=args.get('category','')
    pm=args.get('payment_method',''); from_d=args.get('from_date',''); to_d=args.get('to_date','')
    min_a=args.get('min_amount',''); max_a=args.get('max_amount','')
    conds=['COALESCE(deleted,0)=0']; params=[]
    if month:    conds.append('month=?');          params.append(month)
    if account:  conds.append('account=?');        params.append(account)
    if category: conds.append('category=?');       params.append(category)
    if pm:       conds.append('payment_method=?'); params.append(pm)
    if from_d:   conds.append('date>=?');          params.append(from_d)
    if to_d:     conds.append('date<=?');          params.append(to_d)
    if min_a:    conds.append('amount>=?');        params.append(float(min_a))
    if max_a:    conds.append('amount<=?');        params.append(float(max_a))
    if search:
        conds.append('(description LIKE ? OR notes LIKE ? OR category LIKE ?)')
        params += [f'%{search}%']*3
    where = 'WHERE '+' AND '.join(conds)
    return conn.execute(f'SELECT * FROM income_entries {where} ORDER BY date DESC', params).fetchall()

@app.route('/api/income-entries', methods=['GET'])
def get_income_entries():
    conn = get_db()
    rows = _inc_query(conn, request.args)
    conn.close(); return jsonify([dict(r) for r in rows])

@app.route('/api/income-entries', methods=['POST'])
def add_income_entry():
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    conn = get_db(); m = date_to_month(d['date'])
    cur = conn.execute('INSERT INTO income_entries(date,description,category,account,payment_method,amount,month,notes,is_recurring) VALUES(?,?,?,?,?,?,?,?,?)',
                       (d['date'],d.get('description',''),d.get('category','Other'),
                        d.get('account','Kotak'),d.get('payment_method','UPI'),d['amount'],m,
                        d.get('notes',''),1 if d.get('is_recurring') else 0))
    log_change(conn,'income_entries',cur.lastrowid,'create')
    conn.commit(); conn.close(); return jsonify({'ok':True,'month':m}),201

@app.route('/api/income-entries/<int:id>', methods=['PUT'])
def update_income_entry(id):
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    conn = get_db(); m = date_to_month(d['date'])
    conn.execute('UPDATE income_entries SET date=?,description=?,category=?,account=?,payment_method=?,amount=?,month=?,notes=?,is_recurring=? WHERE id=?',
                 (d['date'],d.get('description',''),d.get('category','Other'),
                  d.get('account','Kotak'),d.get('payment_method','UPI'),d['amount'],m,
                  d.get('notes',''),1 if d.get('is_recurring') else 0,id))
    log_change(conn,'income_entries',id,'update')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/income-entries/<int:id>', methods=['DELETE'])
def delete_income_entry(id):
    conn = get_db()
    conn.execute('UPDATE income_entries SET deleted=1 WHERE id=?',(id,))
    log_change(conn,'income_entries',id,'delete')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/income-entries/<int:id>/restore', methods=['POST'])
def restore_income_entry(id):
    conn = get_db()
    conn.execute('UPDATE income_entries SET deleted=0 WHERE id=?',(id,))
    log_change(conn,'income_entries',id,'restore')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/income-entries/<int:id>/copy-next-month', methods=['POST'])
def copy_income_next_month(id):
    conn = get_db()
    row = dict(conn.execute('SELECT * FROM income_entries WHERE id=?',(id,)).fetchone())
    try:
        dt = datetime.strptime(row['date'],'%Y-%m-%d')
        nd = dt.replace(year=dt.year+1,month=1) if dt.month==12 else dt.replace(month=dt.month+1)
        new_date = nd.strftime('%Y-%m-%d'); new_month = date_to_month(new_date)
        cur = conn.execute('INSERT INTO income_entries(date,description,category,account,payment_method,amount,month,notes,is_recurring) VALUES(?,?,?,?,?,?,?,?,?)',
                           (new_date,row['description'],row['category'],row['account'],row['payment_method'],row['amount'],new_month,row['notes'],row['is_recurring']))
        log_change(conn,'income_entries',cur.lastrowid,'create',{'copied_from':id})
        conn.commit(); conn.close(); return jsonify({'ok':True,'month':new_month})
    except Exception as e:
        conn.close(); return jsonify({'error':str(e)}),400

# ── EXPENSES ──────────────────────────────────────────────────────────────────
def _exp_query(conn, args):
    month=args.get('month',''); search=args.get('search','').strip()
    account=args.get('account',''); category=args.get('category','')
    pm=args.get('payment_method',''); from_d=args.get('from_date',''); to_d=args.get('to_date','')
    min_a=args.get('min_amount',''); max_a=args.get('max_amount','')
    conds=['COALESCE(deleted,0)=0']; params=[]
    if month:    conds.append('month=?');          params.append(month)
    if account:  conds.append('account=?');        params.append(account)
    if category: conds.append('category=?');       params.append(category)
    if pm:       conds.append('payment_method=?'); params.append(pm)
    if from_d:   conds.append('date>=?');          params.append(from_d)
    if to_d:     conds.append('date<=?');          params.append(to_d)
    if min_a:    conds.append('amount>=?');        params.append(float(min_a))
    if max_a:    conds.append('amount<=?');        params.append(float(max_a))
    if search:
        conds.append('(description LIKE ? OR notes LIKE ? OR category LIKE ?)')
        params += [f'%{search}%']*3
    where = 'WHERE '+' AND '.join(conds)
    return conn.execute(f'SELECT * FROM expenses {where} ORDER BY date DESC', params).fetchall()

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    conn = get_db()
    rows = [dict(r) for r in _exp_query(conn, request.args)]
    for r in rows:
        if r['is_split']:
            r['splits'] = [dict(s) for s in conn.execute('SELECT * FROM expense_splits WHERE expense_id=?',(r['id'],)).fetchall()]
    conn.close(); return jsonify(rows)

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    splits   = d.get('splits',[])
    if splits:
        split_sum = sum(float(s.get('amount',0)) for s in splits)
        if abs(split_sum - float(d['amount'])) > 0.01:
            return jsonify({'error':'Split amounts must sum to total expense amount'}), 400
    conn = get_db(); m = date_to_month(d['date'])
    is_split = 1 if splits else 0
    cur = conn.execute('INSERT INTO expenses(date,description,category,account,payment_method,amount,month,notes,is_recurring,is_split) VALUES(?,?,?,?,?,?,?,?,?,?)',
                       (d['date'],d.get('description',''),'Split' if splits else d.get('category','Other'),
                        d.get('account','Kotak'),d.get('payment_method','UPI'),d['amount'],m,
                        d.get('notes',''),1 if d.get('is_recurring') else 0,is_split))
    exp_id = cur.lastrowid
    for s in splits:
        conn.execute('INSERT INTO expense_splits(expense_id,category,amount,description) VALUES(?,?,?,?)',
                     (exp_id,s['category'],s['amount'],s.get('description','')))
    log_change(conn,'expenses',exp_id,'create')
    conn.commit(); conn.close(); return jsonify({'ok':True,'month':m}),201

@app.route('/api/expenses/<int:id>', methods=['PUT'])
def update_expense(id):
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    splits = d.get('splits',[])
    if splits:
        split_sum = sum(float(s.get('amount',0)) for s in splits)
        if abs(split_sum - float(d['amount'])) > 0.01:
            return jsonify({'error':'Split amounts must sum to total expense amount'}), 400
    conn = get_db(); m = date_to_month(d['date'])
    is_split = 1 if splits else 0
    conn.execute('UPDATE expenses SET date=?,description=?,category=?,account=?,payment_method=?,amount=?,month=?,notes=?,is_recurring=?,is_split=? WHERE id=?',
                 (d['date'],d.get('description',''),'Split' if splits else d.get('category','Other'),
                  d.get('account','Kotak'),d.get('payment_method','UPI'),d['amount'],m,
                  d.get('notes',''),1 if d.get('is_recurring') else 0,is_split,id))
    conn.execute('DELETE FROM expense_splits WHERE expense_id=?',(id,))
    for s in splits:
        conn.execute('INSERT INTO expense_splits(expense_id,category,amount,description) VALUES(?,?,?,?)',
                     (id,s['category'],s['amount'],s.get('description','')))
    log_change(conn,'expenses',id,'update')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/expenses/<int:id>', methods=['DELETE'])
def delete_expense(id):
    conn = get_db()
    conn.execute('UPDATE expenses SET deleted=1 WHERE id=?',(id,))
    log_change(conn,'expenses',id,'delete')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/expenses/<int:id>/restore', methods=['POST'])
def restore_expense(id):
    conn = get_db()
    conn.execute('UPDATE expenses SET deleted=0 WHERE id=?',(id,))
    log_change(conn,'expenses',id,'restore')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/expenses/<int:id>/copy-next-month', methods=['POST'])
def copy_expense_next_month(id):
    conn = get_db()
    row    = dict(conn.execute('SELECT * FROM expenses WHERE id=?',(id,)).fetchone())
    splits = [dict(s) for s in conn.execute('SELECT * FROM expense_splits WHERE expense_id=?',(id,)).fetchall()]
    try:
        dt = datetime.strptime(row['date'],'%Y-%m-%d')
        nd = dt.replace(year=dt.year+1,month=1) if dt.month==12 else dt.replace(month=dt.month+1)
        new_date = nd.strftime('%Y-%m-%d'); new_month = date_to_month(new_date)
        cur = conn.execute('INSERT INTO expenses(date,description,category,account,payment_method,amount,month,notes,is_recurring,is_split) VALUES(?,?,?,?,?,?,?,?,?,?)',
                           (new_date,row['description'],row['category'],row['account'],
                            row['payment_method'],row['amount'],new_month,row['notes'],row['is_recurring'],row['is_split']))
        new_id = cur.lastrowid
        for s in splits:
            conn.execute('INSERT INTO expense_splits(expense_id,category,amount,description) VALUES(?,?,?,?)',
                         (new_id,s['category'],s['amount'],s['description']))
        log_change(conn,'expenses',new_id,'create',{'copied_from':id})
        conn.commit(); conn.close(); return jsonify({'ok':True,'month':new_month})
    except Exception as e:
        conn.close(); return jsonify({'error':str(e)}),400

# ── BULK IMPORT ───────────────────────────────────────────────────────────────
@app.route('/api/import/expenses', methods=['POST'])
def import_expenses():
    data = request.json.get('rows',[]); conn = get_db(); imported=0; errors=[]
    for i,row in enumerate(data):
        try:
            amt = float(row.get('amount',0))
            if amt <= 0: raise ValueError('Amount must be > 0')
            m = date_to_month(row['date'])
            conn.execute('INSERT INTO expenses(date,description,category,account,payment_method,amount,month,notes) VALUES(?,?,?,?,?,?,?,?)',
                         (row['date'],row.get('description',''),row.get('category','Other'),
                          row.get('account',''),row.get('payment_method','UPI'),amt,m,row.get('notes','')))
            imported += 1
        except Exception as e:
            errors.append({'row':i+1,'error':str(e)})
    conn.commit(); conn.close()
    return jsonify({'imported':imported,'errors':errors})

@app.route('/api/import/income', methods=['POST'])
def import_income():
    data = request.json.get('rows',[]); conn = get_db(); imported=0; errors=[]
    for i,row in enumerate(data):
        try:
            amt = float(row.get('amount',0))
            if amt <= 0: raise ValueError('Amount must be > 0')
            m = date_to_month(row['date'])
            conn.execute('INSERT INTO income_entries(date,description,category,account,payment_method,amount,month,notes) VALUES(?,?,?,?,?,?,?,?)',
                         (row['date'],row.get('description',''),row.get('category','Other'),
                          row.get('account',''),row.get('payment_method','UPI'),amt,m,row.get('notes','')))
            imported += 1
        except Exception as e:
            errors.append({'row':i+1,'error':str(e)})
    conn.commit(); conn.close()
    return jsonify({'imported':imported,'errors':errors})

# ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
@app.route('/api/subscriptions', methods=['GET'])
def get_subs():
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM subscriptions WHERE COALESCE(deleted,0)=0 ORDER BY status,name").fetchall()]
    today = datetime.today()
    for r in rows:
        r['billing_day']   = r.get('billing_day') or 1
        r['billing_cycle'] = r.get('billing_cycle') or 'monthly'
        r['monthly_equiv'] = round(r['amount']/12,2) if r['billing_cycle']=='annual' else r['amount']
        r['due_this_month'] = r['status']=='active' and r['billing_cycle']=='monthly'
        r['next_date'] = f"{today.year}-{today.month:02d}-{min(r['billing_day'],28):02d}" if r['due_this_month'] else None
    conn.close(); return jsonify(rows)

@app.route('/api/subscriptions', methods=['POST'])
def add_sub():
    d = request.json; conn = get_db()
    conn.execute('INSERT INTO subscriptions(name,amount,description,status,billing_day,billing_cycle) VALUES(?,?,?,?,?,?)',
                 (d['name'],d['amount'],d.get('description',''),d.get('status','active'),d.get('billing_day',1),d.get('billing_cycle','monthly')))
    conn.commit(); conn.close(); return jsonify({'ok':True}),201

@app.route('/api/subscriptions/<int:id>', methods=['PUT'])
def update_sub(id):
    d = request.json; conn = get_db()
    conn.execute('UPDATE subscriptions SET name=?,amount=?,description=?,status=?,billing_day=?,billing_cycle=? WHERE id=?',
                 (d['name'],d['amount'],d.get('description',''),d.get('status','active'),d.get('billing_day',1),d.get('billing_cycle','monthly'),id))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/subscriptions/<int:id>', methods=['DELETE'])
def delete_sub(id):
    conn = get_db(); conn.execute('DELETE FROM subscriptions WHERE id=?',(id,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── BUDGETS ───────────────────────────────────────────────────────────────────
@app.route('/api/budgets', methods=['GET'])
def get_budgets():
    conn = get_db(); month = request.args.get('month','')
    rows = [dict(r) for r in conn.execute('SELECT * FROM budgets ORDER BY category').fetchall()]
    if month:
        for r in rows:
            reg = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE month=? AND category=? AND is_split=0 AND COALESCE(deleted,0)=0',(month,r['category'])).fetchone()[0]
            spl = conn.execute('''SELECT COALESCE(SUM(s.amount),0) FROM expense_splits s JOIN expenses e ON s.expense_id=e.id WHERE e.month=? AND s.category=? AND COALESCE(e.deleted,0)=0''',(month,r['category'])).fetchone()[0]
            r['spent']     = round(reg+spl,2)
            r['remaining'] = round(r['monthly_limit']-r['spent'],2)
            r['pct']       = round((r['spent']/r['monthly_limit']*100),1) if r['monthly_limit'] else 0
    conn.close(); return jsonify(rows)

@app.route('/api/budgets', methods=['POST'])
def add_budget():
    d = request.json; conn = get_db()
    try:
        conn.execute('INSERT INTO budgets(category,monthly_limit) VALUES(?,?)',(d['category'],d.get('monthly_limit',0)))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'error':f"Budget for '{d['category']}' already exists"}),400
    conn.close(); return jsonify({'ok':True}),201

@app.route('/api/budgets/<int:id>', methods=['PUT'])
def update_budget(id):
    d = request.json; conn = get_db()
    conn.execute('UPDATE budgets SET category=?,monthly_limit=? WHERE id=?',(d['category'],d.get('monthly_limit',0),id))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/budgets/<int:id>', methods=['DELETE'])
def delete_budget(id):
    conn = get_db(); conn.execute('DELETE FROM budgets WHERE id=?',(id,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── TRANSFERS ────────────────────────────────────────────────────────────────
@app.route('/api/transfers', methods=['GET'])
def get_transfers():
    month = request.args.get('month',''); conn = get_db()
    where = 'WHERE COALESCE(deleted,0)=0' + (' AND month=?' if month else '')
    rows  = conn.execute(f'SELECT * FROM transfers {where} ORDER BY date DESC', (month,) if month else ()).fetchall()
    conn.close(); return jsonify([dict(r) for r in rows])

@app.route('/api/transfers', methods=['POST'])
def add_transfer():
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    if d.get('from_account') == d.get('to_account'):
        return jsonify({'error':'From and To accounts must be different'}),400
    conn = get_db(); m = date_to_month(d['date'])
    # Duplicate check
    dup = conn.execute('SELECT id FROM transfers WHERE date=? AND from_account=? AND to_account=? AND amount=? AND COALESCE(deleted,0)=0',
                       (d['date'],d['from_account'],d['to_account'],d['amount'])).fetchone()
    if dup:
        conn.close(); return jsonify({'error':'Duplicate transfer — same date, accounts, and amount already exists'}),400
    cur = conn.execute('INSERT INTO transfers(date,from_account,to_account,amount,payment_method,description,notes,month) VALUES(?,?,?,?,?,?,?,?)',
                       (d['date'],d['from_account'],d['to_account'],d['amount'],d.get('payment_method','IMPS'),d.get('description',''),d.get('notes',''),m))
    log_change(conn,'transfers',cur.lastrowid,'create')
    conn.commit(); conn.close(); return jsonify({'ok':True,'month':m}),201

@app.route('/api/transfers/<int:id>', methods=['PUT'])
def update_transfer(id):
    d = request.json
    err = validate_amount(d)
    if err: return jsonify({'error':err}), 400
    if d.get('from_account') == d.get('to_account'):
        return jsonify({'error':'From and To accounts must be different'}),400
    conn = get_db(); m = date_to_month(d['date'])
    conn.execute('UPDATE transfers SET date=?,from_account=?,to_account=?,amount=?,payment_method=?,description=?,notes=?,month=? WHERE id=?',
                 (d['date'],d['from_account'],d['to_account'],d['amount'],d.get('payment_method','IMPS'),d.get('description',''),d.get('notes',''),m,id))
    log_change(conn,'transfers',id,'update')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/transfers/<int:id>', methods=['DELETE'])
def delete_transfer(id):
    conn = get_db()
    conn.execute('UPDATE transfers SET deleted=1 WHERE id=?',(id,))
    log_change(conn,'transfers',id,'delete')
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/transfers/<int:id>/restore', methods=['POST'])
def restore_transfer(id):
    conn = get_db()
    conn.execute('UPDATE transfers SET deleted=0 WHERE id=?',(id,))
    log_change(conn,'transfers',id,'restore')
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── DASHBOARD ─────────────────────────────────────────────────────────────────
@app.route('/api/dashboard')
def get_dashboard():
    conn = get_db(); st = sub_total(conn)
    debt_months = [r[0] for r in conn.execute('SELECT DISTINCT month FROM debt_entries').fetchall()]
    months_set = set(debt_months)
    for tbl in ['account_openings','income_entries','expenses','transfers']:
        for r in conn.execute(f'SELECT DISTINCT month FROM {tbl}').fetchall(): months_set.add(r[0])
    months = sorted(months_set, key=month_key)

    total_debt_entries = conn.execute('SELECT COALESCE(SUM(amount),0) FROM debt_entries').fetchone()[0]
    total_debt   = round(total_debt_entries + st * len(debt_months), 2)
    total_income = conn.execute('SELECT COALESCE(SUM(amount),0) FROM income_entries WHERE COALESCE(deleted,0)=0').fetchone()[0]
    total_exp    = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE COALESCE(deleted,0)=0').fetchone()[0]
    acc_bal      = {acc:v['closing'] for acc,v in acc_summary(conn).items()}

    monthly = []
    for m in months:
        debt_m = conn.execute('SELECT COALESCE(SUM(amount),0) FROM debt_entries WHERE month=?',(m,)).fetchone()[0]+st
        inc_m  = conn.execute('SELECT COALESCE(SUM(amount),0) FROM income_entries WHERE month=? AND COALESCE(deleted,0)=0',(m,)).fetchone()[0]
        exp_m  = conn.execute('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE month=? AND COALESCE(deleted,0)=0',(m,)).fetchone()[0]
        cats_m = {r[0]:round(r[1],2) for r in conn.execute('SELECT category,SUM(amount) FROM expenses WHERE month=? AND is_split=0 AND COALESCE(deleted,0)=0 GROUP BY category',(m,)).fetchall()}
        for row in conn.execute('''SELECT s.category,SUM(s.amount) FROM expense_splits s JOIN expenses e ON s.expense_id=e.id WHERE e.month=? AND COALESCE(e.deleted,0)=0 GROUP BY s.category''',(m,)).fetchall():
            cats_m[row[0]] = round(cats_m.get(row[0],0)+row[1],2)
        nw = sum(v['closing'] for v in acc_summary(conn,m).values())
        monthly.append({'month':m,'debt':round(debt_m,2),'income':round(inc_m,2),
                        'expenses':round(exp_m,2),'net':round(inc_m-debt_m-exp_m,2),
                        'categories':cats_m,'net_worth':round(nw,2)})

    current_cats = monthly[-1]['categories'] if monthly else {}
    conn.close()
    return jsonify({'total_debt':round(total_debt,2),'total_income':round(total_income,2),
                    'total_expenses':round(total_exp,2),'subscription_monthly':round(st,2),
                    'net':round(total_income-total_debt-total_exp,2),
                    'account_balances':acc_bal,'monthly':monthly,
                    'current_month_categories':current_cats})

# ── MONTHLY REPORT ────────────────────────────────────────────────────────────
@app.route('/api/report')
def get_report():
    month = request.args.get('month','')
    if not month: return jsonify({'error':'month required'}),400
    conn = get_db(); st = sub_total(conn)
    entries = conn.execute(
        '''SELECT dc.name, COALESCE(de.amount, 0)
           FROM debt_creditors dc
           LEFT JOIN debt_entries de ON de.creditor_id=dc.id AND de.month=?
           WHERE dc.active=1 ORDER BY dc.sort_order''',
        (month,)).fetchall()
    debt_items = {r[0]: round(r[1], 2) for r in entries}
    debt_items['Subscriptions'] = round(st, 2)
    debt_total = sum(debt_items.values())

    by_inc_cat = {r[0]:round(r[1],2) for r in conn.execute('SELECT category,SUM(amount) FROM income_entries WHERE month=? AND COALESCE(deleted,0)=0 GROUP BY category',(month,)).fetchall()}
    by_inc_acc = {r[0]:round(r[1],2) for r in conn.execute('SELECT account,SUM(amount) FROM income_entries WHERE month=? AND COALESCE(deleted,0)=0 GROUP BY account',(month,)).fetchall()}
    by_inc_pay = {r[0]:round(r[1],2) for r in conn.execute('SELECT payment_method,SUM(amount) FROM income_entries WHERE month=? AND COALESCE(deleted,0)=0 GROUP BY payment_method',(month,)).fetchall()}
    inc_total  = sum(by_inc_acc.values())

    by_exp_cat = {}
    for row in conn.execute('SELECT category,amount FROM expenses WHERE month=? AND is_split=0 AND COALESCE(deleted,0)=0',(month,)).fetchall():
        by_exp_cat[row[0]] = round(by_exp_cat.get(row[0],0)+row[1],2)
    for row in conn.execute('''SELECT s.category,s.amount FROM expense_splits s JOIN expenses e ON s.expense_id=e.id WHERE e.month=? AND COALESCE(e.deleted,0)=0''',(month,)).fetchall():
        by_exp_cat[row[0]] = round(by_exp_cat.get(row[0],0)+row[1],2)

    by_exp_pay = {r[0]:round(r[1],2) for r in conn.execute('SELECT payment_method,SUM(amount) FROM expenses WHERE month=? AND COALESCE(deleted,0)=0 GROUP BY payment_method',(month,)).fetchall()}
    total_exp  = sum(by_exp_cat.values())

    bank_exp = {}
    for row in conn.execute('SELECT account,category,amount FROM expenses WHERE month=? AND is_split=0 AND COALESCE(deleted,0)=0',(month,)).fetchall():
        a,cat,amt=row[0],row[1],row[2]; bank_exp.setdefault(a,{}); bank_exp[a][cat]=round(bank_exp[a].get(cat,0)+amt,2)
    for row in conn.execute('''SELECT e.account,s.category,s.amount FROM expense_splits s JOIN expenses e ON s.expense_id=e.id WHERE e.month=? AND COALESCE(e.deleted,0)=0''',(month,)).fetchall():
        a,cat,amt=row[0],row[1],row[2]; bank_exp.setdefault(a,{}); bank_exp[a][cat]=round(bank_exp[a].get(cat,0)+amt,2)
    for a in bank_exp: bank_exp[a]['__total__']=round(sum(v for k,v in bank_exp[a].items() if k!='__total__'),2)

    bank_inc = {}
    for row in conn.execute('SELECT account,category,amount FROM income_entries WHERE month=? AND COALESCE(deleted,0)=0',(month,)).fetchall():
        a,cat,amt=row; bank_inc.setdefault(a,{}); bank_inc[a][cat]=round(bank_inc[a].get(cat,0)+amt,2)
    for a in bank_inc: bank_inc[a]['__total__']=round(sum(v for k,v in bank_inc[a].items() if k!='__total__'),2)

    pay_cat_exp = {}
    for row in conn.execute('SELECT payment_method,category,amount FROM expenses WHERE month=? AND COALESCE(deleted,0)=0',(month,)).fetchall():
        pm,cat,amt=row; pay_cat_exp.setdefault(pm,{}); pay_cat_exp[pm][cat]=round(pay_cat_exp[pm].get(cat,0)+amt,2)
    for pm in pay_cat_exp: pay_cat_exp[pm]['__total__']=round(sum(v for k,v in pay_cat_exp[pm].items() if k!='__total__'),2)

    transfers = [dict(r) for r in conn.execute('SELECT * FROM transfers WHERE month=? AND COALESCE(deleted,0)=0 ORDER BY date',(month,)).fetchall()]
    acc_s = acc_summary(conn, month)
    conn.close()
    return jsonify({'month':month,'income_by_category':by_inc_cat,'income_by_account':by_inc_acc,
                    'income_by_payment':by_inc_pay,'income_bank_category':bank_inc,'income_total':round(inc_total,2),
                    'debt':debt_items,'debt_total':round(debt_total,2),
                    'expenses_by_category':by_exp_cat,'expenses_by_payment':by_exp_pay,
                    'expenses_bank_category':bank_exp,'expenses_payment_category':pay_cat_exp,
                    'total_expenses':round(total_exp,2),'account_summary':acc_s,'transfers':transfers,
                    'net':round(inc_total-debt_total-total_exp,2)})

@app.route('/api/months')
def get_months():
    conn = get_db(); months = set()
    for tbl in ['debt_entries','account_openings','income_entries','expenses','transfers']:
        for r in conn.execute(f'SELECT DISTINCT month FROM {tbl}').fetchall(): months.add(r[0])
    conn.close(); return jsonify(sorted(months, key=month_key))

if __name__ == '__main__':
    init_db()
    app.run(debug=config.DEBUG, port=config.PORT)
