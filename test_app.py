"""
pytest tests for finance-web app.
Run: pytest test_app.py -v
"""
import os, json, pytest, tempfile, sqlite3

# Use a temp DB for tests
os.environ['FINANCE_DB'] = ':memory:'
os.environ['FINANCE_PASSWORD'] = ''

import app as _app
from app import app, init_db, acc_summary, get_db

@pytest.fixture
def client():
    _app.DB = ':memory:'
    # Patch get_db to use same in-memory connection across test
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    _app.DB = ':memory:'
    with app.test_client() as c:
        with app.app_context():
            # Use fresh on-disk temp DB per test
            tf = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
            tf.close()
            _app.DB = tf.name
            init_db()
            yield c
            os.unlink(tf.name)

# ── auth status ───────────────────────────────────────────────────────────────
def test_auth_status_no_password(client):
    r = client.get('/api/auth/status')
    assert r.status_code == 200
    d = r.get_json()
    assert d['auth_required'] is False

# ── accounts ──────────────────────────────────────────────────────────────────
def test_get_accounts(client):
    r = client.get('/api/accounts')
    assert r.status_code == 200
    accounts = r.get_json()
    assert isinstance(accounts, list)
    assert any(a['name'] == 'Kotak' for a in accounts)

def test_add_account(client):
    r = client.post('/api/accounts', json={'name':'TestBank','account_type':'Bank'})
    assert r.status_code == 201
    accounts = client.get('/api/accounts').get_json()
    assert any(a['name']=='TestBank' for a in accounts)

def test_duplicate_account(client):
    client.post('/api/accounts', json={'name':'DupBank','account_type':'Bank'})
    r = client.post('/api/accounts', json={'name':'DupBank','account_type':'Bank'})
    assert r.status_code == 400

def test_rename_cascade(client):
    # Add expense for Kotak
    client.post('/api/expenses', json={
        'date':'2026-07-01','amount':100,'category':'Other',
        'account':'Kotak','payment_method':'UPI'
    })
    # Rename Kotak → KotakNew
    accounts = client.get('/api/accounts').get_json()
    kotak = next(a for a in accounts if a['name']=='Kotak')
    r = client.put(f'/api/accounts/{kotak["id"]}', json={
        'name':'KotakNew','account_type':'Bank','notes':'','active':1,'sort_order':1
    })
    assert r.status_code == 200
    # Expense should have new account name
    exps = client.get('/api/expenses').get_json()
    assert all(e['account'] != 'Kotak' for e in exps)
    assert any(e['account'] == 'KotakNew' for e in exps)

# ── expenses ──────────────────────────────────────────────────────────────────
def test_add_expense(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-10','amount':250,'category':'Food & Dining',
        'account':'Kotak','payment_method':'UPI'
    })
    assert r.status_code == 201

def test_expense_amount_validation(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-10','amount':-50,'category':'Other',
        'account':'Kotak','payment_method':'UPI'
    })
    assert r.status_code == 400
    assert 'greater than 0' in r.get_json()['error']

def test_expense_zero_amount(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-10','amount':0,'category':'Other',
        'account':'Kotak','payment_method':'UPI'
    })
    assert r.status_code == 400

def test_soft_delete_expense(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-15','amount':100,'category':'Other',
        'account':'Kotak','payment_method':'Cash'
    })
    # Get the ID by fetching expenses
    exps = client.get('/api/expenses?month=Jul 2026').get_json()
    exp = next(e for e in exps if e['amount']==100 and e['category']=='Other')
    eid = exp['id']
    # Delete (soft)
    client.delete(f'/api/expenses/{eid}')
    exps_after = client.get('/api/expenses?month=Jul 2026').get_json()
    assert not any(e['id']==eid for e in exps_after)
    # Restore
    client.post(f'/api/expenses/{eid}/restore')
    exps_restored = client.get('/api/expenses?month=Jul 2026').get_json()
    assert any(e['id']==eid for e in exps_restored)

# ── split expenses ────────────────────────────────────────────────────────────
def test_split_total_validation(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-01','amount':300,'account':'Kotak','payment_method':'UPI',
        'splits':[{'category':'Food & Dining','amount':100},{'category':'Transport','amount':100}]
    })
    assert r.status_code == 400
    assert 'split' in r.get_json()['error'].lower()

def test_split_expense_ok(client):
    r = client.post('/api/expenses', json={
        'date':'2026-07-01','amount':300,'account':'Kotak','payment_method':'UPI',
        'splits':[{'category':'Food & Dining','amount':200},{'category':'Transport','amount':100}]
    })
    assert r.status_code == 201

# ── transfers ─────────────────────────────────────────────────────────────────
def test_transfer_same_account(client):
    r = client.post('/api/transfers', json={
        'date':'2026-07-01','from_account':'Kotak','to_account':'Kotak','amount':500
    })
    assert r.status_code == 400

def test_transfer_duplicate(client):
    d = {'date':'2026-07-01','from_account':'Kotak','to_account':'HDFC','amount':1000,'payment_method':'IMPS'}
    client.post('/api/transfers', json=d)
    r = client.post('/api/transfers', json=d)
    assert r.status_code == 400
    assert 'duplicate' in r.get_json()['error'].lower()

def test_soft_delete_transfer(client):
    r = client.post('/api/transfers', json={
        'date':'2026-07-02','from_account':'Kotak','to_account':'HDFC','amount':250,'payment_method':'IMPS'
    })
    trs = client.get('/api/transfers').get_json()
    tr  = next(t for t in trs if t['amount']==250)
    client.delete(f'/api/transfers/{tr["id"]}')
    trs_after = client.get('/api/transfers').get_json()
    assert not any(t['id']==tr['id'] for t in trs_after)
    client.post(f'/api/transfers/{tr["id"]}/restore')
    trs_restored = client.get('/api/transfers').get_json()
    assert any(t['id']==tr['id'] for t in trs_restored)

# ── balance formula ───────────────────────────────────────────────────────────
def test_balance_formula(client):
    """closing = opening + income + transfers_in - expenses - transfers_out"""
    # Reset with known data: add opening for a fresh month
    client.post('/api/account-openings', json={'month':'Mar 2025','account':'Kotak','opening_balance':1000})
    client.post('/api/income-entries', json={'date':'2025-03-01','amount':500,'category':'Salary','account':'Kotak','payment_method':'UPI'})
    client.post('/api/expenses', json={'date':'2025-03-02','amount':200,'category':'Other','account':'Kotak','payment_method':'UPI'})
    r = client.get('/api/report?month=Mar 2025')
    assert r.status_code == 200
    d = r.get_json()
    kotak = d['account_summary']['Kotak']
    assert kotak['opening'] == 1000
    assert kotak['income']  == 500
    assert kotak['expenses']== 200
    assert kotak['closing'] == 1300  # 1000 + 500 - 200

# ── income entries ────────────────────────────────────────────────────────────
def test_soft_delete_income(client):
    r = client.post('/api/income-entries', json={
        'date':'2026-07-20','amount':5000,'category':'Salary','account':'Kotak','payment_method':'UPI'
    })
    entries = client.get('/api/income-entries?month=Jul 2026').get_json()
    entry   = next(e for e in entries if e['amount']==5000)
    eid = entry['id']
    client.delete(f'/api/income-entries/{eid}')
    after = client.get('/api/income-entries?month=Jul 2026').get_json()
    assert not any(e['id']==eid for e in after)
    client.post(f'/api/income-entries/{eid}/restore')
    restored = client.get('/api/income-entries?month=Jul 2026').get_json()
    assert any(e['id']==eid for e in restored)

# ── CSV import ────────────────────────────────────────────────────────────────
def test_import_expenses(client):
    r = client.post('/api/import/expenses', json={'rows':[
        {'date':'2026-07-01','amount':'100','category':'Food & Dining','account':'Kotak','payment_method':'UPI'},
        {'date':'2026-07-02','amount':'200','category':'Transport','account':'Kotak','payment_method':'Cash'},
        {'date':'bad-date','amount':'-5','category':'Other'},  # should fail
    ]})
    assert r.status_code == 200
    d = r.get_json()
    assert d['imported'] == 2
    assert len(d['errors']) == 1

# ── months endpoint ───────────────────────────────────────────────────────────
def test_months_endpoint(client):
    months = client.get('/api/months').get_json()
    assert isinstance(months, list)
    assert 'Jul 2026' in months

# ── budget ────────────────────────────────────────────────────────────────────
def test_budget_crud(client):
    r = client.post('/api/budgets', json={'category':'Food & Dining','monthly_limit':3000})
    assert r.status_code == 201
    budgets = client.get('/api/budgets?month=Jul 2026').get_json()
    b = next(b for b in budgets if b['category']=='Food & Dining')
    assert b['monthly_limit'] == 3000
    # Update
    client.put(f'/api/budgets/{b["id"]}', json={'category':'Food & Dining','monthly_limit':4000})
    budgets2 = client.get('/api/budgets').get_json()
    b2 = next(b for b in budgets2 if b['category']=='Food & Dining')
    assert b2['monthly_limit'] == 4000

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
