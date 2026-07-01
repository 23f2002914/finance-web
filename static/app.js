/* ── GLOBALS ──────────────────────────────────────────────────────────────── */
const EXP_CATS  = ['Food & Dining','Transport','Shopping','Entertainment','Health & Medical','Education','Utilities','Personal Care','Other'];
const INC_CATS  = ['Rental','Refund','Salary','Freelance','Gift','Interest','Other'];
const CAT_COLORS= ['#E74C3C','#3498DB','#9B59B6','#1ABC9C','#E67E22','#27AE60','#F39C12','#2980B9','#95A5A6'];
const ACC_COLORS= ['#1A5276','#A04000','#6C3483','#1E8449','#117A65','#7D6608','#6E2F1A','#4A235A'];

let chart=null, donutChart=null, trendsChart=null, netWorthChart=null, debtHistChart=null;
let _accounts = [];
let _accColorMap = {};
let _editId = null;
let _importType = 'expenses';
let _importRows  = [];
let _allExpenses = [];
let _allIncome   = [];
let _expPage = 1;
let _incPage = 1;
const PAGE_SIZE = 50;

let _debtCreditors = [];
const _rowCache = { income: new Map(), expenses: new Map(), transfers: new Map(),
                    debts: new Map(), accounts: new Map(), budgets: new Map(), subs: new Map() };

function openRow(type, id) {
  const row = _rowCache[type].get(id);
  if (!row) return;
  const dispatch = { income: showIncomeEntryModal, expenses: showExpenseModal,
                     transfers: showTransferModal, accounts: showAccountModal,
                     budgets: showBudgetModal, subs: showSubModal };
  dispatch[type]?.(row);
}
function openDebtRow(month) {
  const row = _rowCache.debts.get(month);
  if (row) showDebtModal(row);
}

/* ── API HELPER ──────────────────────────────────────────────────────────── */
async function api(path, method='GET', body=null) {
  const opts = { method, headers: {} };
  if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(path, opts);
  if (r.status === 401) { checkAuth(); throw new Error('Unauthorized'); }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.error || msg; } catch(_){}
    throw new Error(msg);
  }
  return r.json();
}

/* ── THEME / DARK MODE ───────────────────────────────────────────────────── */
function applyTheme() {
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
}
function toggleDark() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  localStorage.setItem('theme', cur === 'dark' ? 'light' : 'dark');
  applyTheme();
  // Rebuild charts for new theme colors
  [chart, donutChart, trendsChart, netWorthChart, debtHistChart].forEach(c => { if(c) c.destroy(); });
  chart=donutChart=trendsChart=netWorthChart=debtHistChart=null;
  if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();
  if (document.getElementById('tab-debts').classList.contains('active')) renderDebts();
}

/* ── AUTH ────────────────────────────────────────────────────────────────── */
async function checkAuth() {
  try {
    const s = await api('/api/auth/status');
    if (s.auth_required && !s.logged_in) {
      document.getElementById('login-modal').classList.add('open');
      return false;
    }
    return true;
  } catch(_) { return true; }
}
async function doLogin() {
  const pw = document.getElementById('login-password').value;
  document.getElementById('login-error').textContent = '';
  try {
    await api('/api/auth/login', 'POST', { password: pw });
    document.getElementById('login-modal').classList.remove('open');
    await init();
  } catch(_) {
    document.getElementById('login-error').textContent = 'Wrong password. Try again.';
  }
}

/* ── MODAL HELPERS ───────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── TOAST ───────────────────────────────────────────────────────────────── */
function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast-msg' + (type ? ' '+type : '');
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showUndoToast(label, undoFn, reloadFn) {
  const container = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-msg';
  const txt = document.createElement('span');
  txt.textContent = `Deleted ${label}`;
  const btn = document.createElement('button');
  btn.className = 'toast-undo-btn';
  btn.textContent = 'Undo';
  el.appendChild(txt); el.appendChild(btn);
  container.appendChild(el);
  btn.onclick = () => {
    undoFn().then(() => { reloadFn(); toast('Restored!', 'success'); }).catch(e=>toast(e.message,'error'));
    el.remove();
  };
  setTimeout(() => { if(el.parentNode) el.remove(); }, 5000);
}

/* ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const modalOpen = document.querySelector('.overlay.open');
  if (e.key === 'Escape' && modalOpen) { modalOpen.classList.remove('open'); return; }
  if (modalOpen) return;
  const tab = document.querySelector('nav.top-nav button.active')?.dataset.tab ||
              document.querySelector('nav.bottom-nav button.active')?.dataset.tab || '';
  const key = e.key.toLowerCase();
  if (key === 'n') {
    const map = { expenses:'showExpenseModal', income:'showIncomeEntryModal', transfers:'showTransferModal',
                  debts:'showDebtModal', accounts:'showAccountModal', budgets:'showBudgetModal',
                  subscriptions:'showSubModal' };
    if (map[tab]) { window[map[tab]](); return; }
  }
  if (key === 'd') { switchTab('dashboard'); return; }
  if (key === 'e') { switchTab('expenses'); return; }
  if (key === 'i') { switchTab('income'); return; }
  if (key === 'r') { switchTab('report'); return; }
  if (key === 't') { switchTab('transfers'); return; }
  if (e.key === '?') { showShortcuts(); return; }
});

function showShortcuts() { openModal('shortcuts-modal'); }
function showExportMenu() { openModal('export-modal'); }
function exportCSV(type) { window.location.href = `/api/export/csv?type=${type}`; }

/* ── FORMAT ──────────────────────────────────────────────────────────────── */
function inr(n) { return '₹' + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function month_key(m) { try { const d=new Date(m+' 01'); return d.getFullYear()*100+d.getMonth(); } catch(_){ return 0; } }

/* ── BADGES ──────────────────────────────────────────────────────────────── */
function acctBadge(name) {
  if (!name) return '—';
  if (!_accColorMap[name]) {
    const keys = Object.keys(_accColorMap);
    _accColorMap[name] = ACC_COLORS[keys.length % ACC_COLORS.length];
  }
  const c = _accColorMap[name];
  const escaped = String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<span class="badge" style="background:${c}22;color:${c}">${escaped}</span>`;
}
const PM_COLORS = {'UPI':'#1ABC9C','Card - Debit':'#3498DB','Card - Credit':'#9B59B6','Cash':'#E67E22','Net Banking':'#2980B9','Cheque':'#7F8C8D','IMPS':'#16A085','NEFT':'#2ECC71','Other':'#95A5A6'};
function pmBadge(pm) {
  const c = PM_COLORS[pm] || '#95A5A6';
  return `<span class="badge" style="background:${c}22;color:${c}">${pm||'—'}</span>`;
}
function catBadge(cat) {
  let i = EXP_CATS.indexOf(cat);
  if (i < 0) i = INC_CATS.indexOf(cat);
  const c = i>=0 ? CAT_COLORS[i % CAT_COLORS.length] : (cat==='Split'?'#1A73E8':'#95A5A6');
  return `<span class="badge" style="background:${c}22;color:${c}">${cat||'—'}</span>`;
}

/* ── ACCOUNTS ────────────────────────────────────────────────────────────── */
async function loadAccounts() {
  _accounts = await api('/api/accounts/list');
  _accColorMap = {};
  _accounts.forEach(a => {
    if(!_accColorMap[a.name]) {
      const i = Object.keys(_accColorMap).length;
      _accColorMap[a.name] = ACC_COLORS[i % ACC_COLORS.length];
    }
  });
}
function populateAccountSel(id, selected='') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = _accounts.map(a => `<option ${a.name===selected?'selected':''}>${a.name}</option>`).join('');
}

/* ── TAB SWITCHING ───────────────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  const pane = document.getElementById('tab-'+name);
  if (pane) pane.classList.add('active');
  const renders = {
    dashboard: renderDashboard,
    accounts: renderAccounts,
    transfers: () => renderTransfers(document.getElementById('tr-month-filter')?.value||''),
    debts: renderDebts,
    income: () => renderIncome(),
    expenses: () => renderExpenses(),
    budgets: renderBudgets,
    report: ()=>{},
    subscriptions: renderSubscriptions,
    tools: ()=>{},
  };
  if (renders[name]) renders[name]();
}

/* ── MONTH DROPDOWNS ─────────────────────────────────────────────────────── */
async function populateMonthDropdowns() {
  const months = await api('/api/months');
  // Populate account filter options
  const accOpts = '<option value="">All accounts</option>' +
    _accounts.map(a=>`<option>${a.name}</option>`).join('');

  const configs = [
    { id:'dash-month-filter',    prefix:'<option value="">All time</option>' },
    { id:'tr-month-filter',      prefix:'<option value="">All months</option>' },
    { id:'inc-month-filter',     prefix:'<option value="">All months</option>' },
    { id:'exp-month-filter',     prefix:'<option value="">All months</option>' },
    { id:'report-month-sel',     prefix:'<option value="">— Select —</option>' },
    { id:'budget-month-filter',  prefix:'<option value="">Select month…</option>' },
  ];
  configs.forEach(({id, prefix}) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = prefix + months.map(m=>`<option ${m===cur?'selected':''}>${m}</option>`).join('');
  });
  ['inc-account-filter','exp-account-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const cur=el.value; el.innerHTML=accOpts; if(cur) el.value=cur; }
  });
}

/* ── DASHBOARD ───────────────────────────────────────────────────────────── */
async function renderDashboard() {
  const data      = await api('/api/dashboard');
  const selMonth  = document.getElementById('dash-month-filter').value;
  const monthly   = data.monthly || [];
  const focusRow  = selMonth ? monthly.find(m=>m.month===selMonth) : null;

  document.getElementById('d-income').textContent = inr(data.total_income);
  document.getElementById('d-debt').textContent   = inr(data.total_debt);
  document.getElementById('d-exp').textContent    = inr(data.total_expenses);
  document.getElementById('d-sub').textContent    = inr(data.subscription_monthly);
  document.getElementById('d-net').textContent    = inr(data.net);

  // Account balance cards
  const balDiv = document.getElementById('dash-acc-balances');
  balDiv.innerHTML = Object.entries(data.account_balances).map(([acc,bal]) =>
    `<div class="acc-card" onclick="switchTab('accounts')" style="cursor:pointer">
       <span class="acc-name">${acc}</span>
       <span class="acc-val inr" style="color:${bal<0?'var(--debt-h)':'var(--text)'}">${inr(bal)}</span>
     </div>`).join('');

  // Budget strip
  const bMonth = selMonth || (monthly.length ? monthly[monthly.length-1].month : '');
  await renderBudgetStrip(bMonth);

  // Chart defaults
  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#8B949E' : '#6C757D';
  const months    = monthly.map(m=>m.month);
  const incomes   = monthly.map(m=>m.income);
  const exps      = monthly.map(m=>m.expenses);
  const nws       = monthly.map(m=>m.net_worth);

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('bar-chart'), {
    type:'bar',
    data:{ labels:months, datasets:[
      {label:'Income',   data:incomes, backgroundColor:'#1E8449CC'},
      {label:'Expenses', data:exps,    backgroundColor:'#6C3483CC'}
    ]},
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{labels:{color:textColor}} },
      scales:{ x:{ticks:{color:textColor},grid:{color:gridColor}}, y:{ticks:{color:textColor},grid:{color:gridColor}} }
    }
  });

  const cats      = focusRow?.categories || data.current_month_categories || {};
  const catLabels = Object.keys(cats);
  const catVals   = Object.values(cats);
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donut-chart'), {
    type:'doughnut',
    data:{ labels:catLabels, datasets:[{data:catVals, backgroundColor:CAT_COLORS.slice(0,catLabels.length), borderWidth:2}] },
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{position:'right', labels:{color:textColor,font:{size:11}}} }
    }
  });

  if (trendsChart) trendsChart.destroy();
  trendsChart = new Chart(document.getElementById('trends-chart'), {
    type:'line',
    data:{ labels:months, datasets:[
      {label:'Income',   data:incomes, borderColor:'#1E8449', backgroundColor:'#1E844918', tension:.35, fill:true},
      {label:'Expenses', data:exps,    borderColor:'#6C3483', backgroundColor:'#6C348318', tension:.35, fill:true},
    ]},
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{labels:{color:textColor}} },
      scales:{ x:{ticks:{color:textColor},grid:{color:gridColor}}, y:{ticks:{color:textColor},grid:{color:gridColor}} }
    }
  });

  if (netWorthChart) netWorthChart.destroy();
  netWorthChart = new Chart(document.getElementById('networth-chart'), {
    type:'line',
    data:{ labels:months, datasets:[{label:'Net Worth', data:nws, borderColor:'#1A5276', backgroundColor:'#1A527618', tension:.35, fill:true}] },
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{labels:{color:textColor}} },
      scales:{ x:{ticks:{color:textColor},grid:{color:gridColor}}, y:{ticks:{color:textColor},grid:{color:gridColor}} }
    }
  });
}

async function renderBudgetStrip(month) {
  const strip = document.getElementById('dash-budget-strip');
  if (!month) { strip.innerHTML=''; return; }
  try {
    const budgets = await api(`/api/budgets?month=${encodeURIComponent(month)}`);
    if (!budgets.length) { strip.innerHTML=''; return; }
    strip.innerHTML = budgets.map(b => {
      const pct  = Math.min(b.pct||0, 100);
      const over = (b.pct||0) > 100;
      const color= over ? '#C0392B' : pct>80 ? '#E67E22' : '#1E8449';
      return `<div class="budget-strip-item">
        <div class="bsi-label"><span>${b.category}</span><span style="color:${color}">${b.pct||0}%</span></div>
        <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bsi-nums"><span>${inr(b.spent||0)} spent</span><span>${inr(b.monthly_limit)} limit</span></div>
      </div>`;
    }).join('');
  } catch(_) { strip.innerHTML=''; }
}

/* ── ACCOUNTS ────────────────────────────────────────────────────────────── */
let _editAccountId = null;
async function renderAccounts() {
  const [rows, openings] = await Promise.all([api('/api/accounts'), api('/api/account-openings')]);
  _rowCache.accounts.clear();
  rows.forEach(r => _rowCache.accounts.set(r.id, r));
  const tbody = document.getElementById('acc-tbody');
  tbody.innerHTML = rows.map(r => `
    <tr onclick="openRow('accounts',${r.id})">
      <td><strong>${r.name}</strong></td>
      <td><span class="badge" style="background:var(--save);color:var(--save-h)">${r.account_type}</span></td>
      <td style="color:var(--muted);font-size:12px">${r.notes||'—'}</td>
      <td><span class="badge badge-${r.active?'active':'inactive'}">${r.active?'Active':'Inactive'}</span></td>
      <td class="inr" style="font-weight:700;color:${r.closing_balance<0?'var(--debt-h)':'var(--inc-h)'}">${inr(r.closing_balance)}</td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" onclick="openRow('accounts',${r.id})">✏</button>
          <button class="btn-icon btn-del" onclick="delAccount(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">No accounts yet.</td></tr>`;

  const oc = document.getElementById('openings-container');
  if (!openings.length) { oc.innerHTML=`<div class="empty">No opening balances set.</div>`; return; }
  oc.innerHTML = openings.map(mo => `
    <table class="acc-table" style="margin-bottom:1px">
      <thead>
        <tr><th colspan="6" style="background:var(--save-h)">${mo.month}</th></tr>
        <tr style="background:rgba(0,0,0,.15)"><th>Account</th><th>Opening</th><th>Income</th><th>Expenses</th><th>Closing</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${mo.accounts.map(a=>{_rowCache.accounts.set('op_'+a.id, a); return `<tr onclick="showOpeningModal(_rowCache.accounts.get('op_${a.id}'))">
          <td>${acctBadge(a.account)}</td>
          <td class="inr">${inr(a.opening_balance)}</td>
          <td class="inr" style="color:var(--inc-h)">${inr(a.income)}</td>
          <td class="inr" style="color:var(--debt-h)">${inr(a.expenses)}</td>
          <td class="inr" style="font-weight:700">${inr(a.closing)}</td>
          <td onclick="event.stopPropagation()">
            <div class="actions">
              <button class="btn-icon" onclick="showOpeningModal(_rowCache.accounts.get('op_${a.id}'))">✏</button>
              <button class="btn-icon btn-del" onclick="delOpening(${a.id})">🗑</button>
            </div>
          </td>
        </tr>`; }).join('')}
      </tbody>
    </table>`).join('');
}

function showAccountModal(row=null) {
  _editAccountId = row?.id || null;
  document.getElementById('account-modal-title').textContent = row ? 'Edit Account' : 'Add Account';
  document.getElementById('acc-name').value   = row?.name || '';
  document.getElementById('acc-type').value   = row?.account_type || 'Bank';
  document.getElementById('acc-notes').value  = row?.notes || '';
  document.getElementById('acc-sort').value   = row?.sort_order ?? 99;
  document.getElementById('acc-active').value = String(row?.active ?? 1);
  openModal('account-modal');
}
async function saveAccount() {
  const d = { name:document.getElementById('acc-name').value.trim(),
    account_type:document.getElementById('acc-type').value,
    notes:document.getElementById('acc-notes').value,
    sort_order:+document.getElementById('acc-sort').value,
    active:+document.getElementById('acc-active').value };
  if (!d.name) { toast('Name is required','error'); return; }
  try {
    if (_editAccountId) await api(`/api/accounts/${_editAccountId}`,'PUT',d);
    else await api('/api/accounts','POST',d);
    closeModal('account-modal'); await loadAccounts(); renderAccounts(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delAccount(id) {
  if (!confirm('Delete this account? This cannot be undone.')) return;
  await api(`/api/accounts/${id}`,'DELETE'); renderAccounts();
}

let _editOpeningId = null;
function showOpeningModal(row=null) {
  _editOpeningId = row?.id || null;
  document.getElementById('opening-modal-title').textContent = row ? 'Edit Opening Balance' : 'Add Opening Balance';
  document.getElementById('op-month').value   = row?.month || '';
  document.getElementById('op-balance').value = row?.opening_balance ?? 0;
  populateAccountSel('op-account', row?.account||'');
  openModal('opening-modal');
}
async function saveOpening() {
  const d = { month:document.getElementById('op-month').value.trim(),
    account:document.getElementById('op-account').value,
    opening_balance:+document.getElementById('op-balance').value };
  if (!d.month) { toast('Month is required','error'); return; }
  try {
    if (_editOpeningId) await api(`/api/account-openings/${_editOpeningId}`,'PUT',d);
    else await api('/api/account-openings','POST',d);
    closeModal('opening-modal'); renderAccounts(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delOpening(id) {
  await api(`/api/account-openings/${id}`,'DELETE'); renderAccounts();
}

/* ── DEBTS ───────────────────────────────────────────────────────────────── */
async function loadDebtCreditors() {
  _debtCreditors = await api('/api/debt-creditors');
}

async function renderDebts() {
  const { creditors, rows } = await api('/api/debts');
  _debtCreditors = creditors;

  // Build dynamic thead
  const thead = document.getElementById('debt-thead-row');
  if (thead) {
    thead.innerHTML = '<th>Month</th>' +
      creditors.map(c=>`<th>${c.name}</th>`).join('') +
      '<th>Subscriptions</th><th>Total</th><th>Actions</th>';
  }

  // Build tbody
  _rowCache.debts.clear();
  document.getElementById('debt-tbody').innerHTML = rows.map(r => {
    _rowCache.debts.set(r.month, r);
    const entryCells = creditors.map(c => {
      const e = r.entries.find(e=>e.creditor_id===c.id);
      return `<td class="inr">${inr(e?.amount||0)}</td>`;
    }).join('');
    const escapedMonth = String(r.month).replace(/'/g, "\\'");
    return `<tr onclick="openDebtRow('${escapedMonth}')">
      <td><strong>${r.month}</strong></td>
      ${entryCells}
      <td class="inr">${inr(r.subscriptions)}</td>
      <td class="inr" style="font-weight:700;color:var(--debt-h)">${inr(r.total)}</td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" onclick="openDebtRow('${escapedMonth}')">✏</button>
          <button class="btn-icon btn-del" onclick="delDebt('${r.month}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="${creditors.length+4}" class="empty">No debt data.</td></tr>`;

  // Creditor manager list
  renderCreditorManager(creditors);

  // Debt history chart
  const hist = await api('/api/debts/history');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#8B949E' : '#6C757D';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  if (debtHistChart) debtHistChart.destroy();
  const DEBT_COLORS = ['#C0392B','#E67E22','#9B59B6','#2980B9','#16A085','#27AE60','#8E44AD'];
  debtHistChart = new Chart(document.getElementById('debt-hist-chart'), {
    type:'bar',
    data:{ labels:hist.months, datasets: Object.entries(hist.series).map(([k,v],i)=>({
      label:k, data:v, backgroundColor:DEBT_COLORS[i%DEBT_COLORS.length]+'BB', stack:'debt'
    }))},
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{labels:{color:textColor}} },
      scales:{ x:{stacked:true,ticks:{color:textColor},grid:{color:gridColor}},
               y:{stacked:true,ticks:{color:textColor},grid:{color:gridColor}} }
    }
  });
}

function renderCreditorManager(creditors) {
  const el = document.getElementById('creditor-list-body');
  if (!el) return;
  if (!creditors.length) { el.innerHTML='<p style="color:var(--muted)">No creditors yet.</p>'; return; }
  el.innerHTML = `<table class="acc-table"><thead><tr>
    <th>Name</th><th>Sort</th><th>Active</th><th>Actions</th>
  </tr></thead><tbody>` +
  creditors.map(c=>`<tr>
    <td><strong>${c.name}</strong></td>
    <td>${c.sort_order}</td>
    <td><span class="badge badge-${c.active?'active':'inactive'}">${c.active?'Yes':'No'}</span></td>
    <td><div class="actions">
      <button class="btn-icon" onclick='showCreditorModal(${JSON.stringify(c)})'>✏</button>
      <button class="btn-icon btn-del" onclick="delCreditor(${c.id})">🗑</button>
    </div></td>
  </tr>`).join('') + '</tbody></table>';
}

function showDebtModal(row=null) {
  document.getElementById('debt-modal-title').textContent = row ? 'Edit Debt Month' : 'Add Debt Month';
  document.getElementById('debt-month').value = row?.month || '';
  // Build dynamic creditor inputs
  const container = document.getElementById('debt-creditor-inputs');
  container.innerHTML = _debtCreditors.filter(c=>c.active).map(c => {
    const entry = row?.entries?.find(e=>e.creditor_id===c.id);
    return `<div class="field">
      <label class="field-label">${c.name} (₹)</label>
      <input type="number" step="0.01" min="0" value="${entry?.amount||0}"
             data-creditor-id="${c.id}" class="debt-entry-input">
    </div>`;
  }).join('');
  openModal('debt-modal');
}

async function saveDebt() {
  const month = document.getElementById('debt-month').value.trim();
  if (!month) { toast('Month is required','error'); return; }
  const entries = [...document.querySelectorAll('.debt-entry-input')].map(el=>({
    creditor_id: +el.dataset.creditorId, amount: +el.value || 0
  }));
  try {
    await api('/api/debts','POST',{ month, entries });
    closeModal('debt-modal'); renderDebts(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}

async function delDebt(month) {
  if (!confirm(`Delete all debt entries for ${month}?`)) return;
  await api(`/api/debts/${encodeURIComponent(month)}`,'DELETE'); renderDebts();
}

/* ── CREDITORS ───────────────────────────────────────────────────────────── */
function showCreditorModal(cred=null) {
  document.getElementById('creditor-modal-title').textContent = cred ? 'Edit Creditor' : 'Add Creditor';
  document.getElementById('creditor-id').value     = cred?.id || '';
  document.getElementById('creditor-name').value   = cred?.name || '';
  document.getElementById('creditor-sort').value   = cred?.sort_order ?? 99;
  document.getElementById('creditor-active').value = String(cred?.active ?? 1);
  openModal('creditor-modal');
}
async function saveCreditor() {
  const id   = document.getElementById('creditor-id').value;
  const name = document.getElementById('creditor-name').value.trim();
  if (!name) { toast('Name is required','error'); return; }
  const d = { name, sort_order:+document.getElementById('creditor-sort').value,
              active:+document.getElementById('creditor-active').value };
  try {
    if (id) await api(`/api/debt-creditors/${id}`,'PUT',d);
    else    await api('/api/debt-creditors','POST',d);
    closeModal('creditor-modal'); renderDebts(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delCreditor(id) {
  if (!confirm('Delete this creditor? This will fail if it has existing debt entries.')) return;
  try {
    await api(`/api/debt-creditors/${id}`,'DELETE'); renderDebts(); toast('Deleted','success');
  } catch(e) { toast(e.message,'error'); }
}

/* ── INCOME ──────────────────────────────────────────────────────────────── */
let _editIncomeId = null;

function buildIncomeFilterParams() {
  const p = new URLSearchParams();
  const v = id => document.getElementById(id)?.value || '';
  if (v('inc-month-filter'))   p.set('month',          v('inc-month-filter'));
  if (v('inc-account-filter')) p.set('account',        v('inc-account-filter'));
  if (v('inc-cat-filter'))     p.set('category',       v('inc-cat-filter'));
  if (v('inc-pm-filter'))      p.set('payment_method', v('inc-pm-filter'));
  if (v('inc-from-date'))      p.set('from_date',      v('inc-from-date'));
  if (v('inc-to-date'))        p.set('to_date',        v('inc-to-date'));
  if (v('inc-min-amt'))        p.set('min_amount',     v('inc-min-amt'));
  if (v('inc-max-amt'))        p.set('max_amount',     v('inc-max-amt'));
  if (v('inc-search'))         p.set('search',         v('inc-search'));
  return p;
}
async function applyIncFilters() { _incPage=1; await renderIncome(); }
function clearIncFilters() {
  ['inc-search','inc-month-filter','inc-account-filter','inc-cat-filter','inc-pm-filter',
   'inc-from-date','inc-to-date','inc-min-amt','inc-max-amt'].forEach(id => {
    const el=document.getElementById(id); if(el) el.value='';
  });
  applyIncFilters();
}

async function renderIncome() {
  const p = buildIncomeFilterParams();
  _allIncome = await api('/api/income-entries?' + p.toString());
  renderIncPage();
}

function renderIncPage() {
  const total = _allIncome.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  if (_incPage > pages) _incPage = pages;
  const slice = _allIncome.slice((_incPage-1)*PAGE_SIZE, _incPage*PAGE_SIZE);
  const pageTotal = slice.reduce((s,r)=>s+r.amount, 0);

  _rowCache.income.clear();
  slice.forEach(r => _rowCache.income.set(r.id, r));
  document.getElementById('inc-tbody').innerHTML = slice.map(r => `
    <tr onclick="openRow('income',${r.id})">
      <td>${r.date}</td>
      <td>${r.description||'—'}</td>
      <td>${catBadge(r.category)}</td>
      <td>${acctBadge(r.account)}</td>
      <td>${pmBadge(r.payment_method)}</td>
      <td class="inr" style="font-weight:700;color:var(--inc-h)">${inr(r.amount)}</td>
      <td style="font-size:12px;color:var(--muted)">${r.notes||'—'}</td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" title="Copy to next month" onclick="copyIncNextMonth(${r.id})">📋</button>
          <button class="btn-icon btn-del" onclick="delIncome(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="8" class="empty">No income entries found.</td></tr>`;

  const tfoot = document.getElementById('inc-tfoot');
  if (total > 0) {
    tfoot.style.display=''; document.getElementById('inc-page-total').textContent=inr(pageTotal);
  } else { tfoot.style.display='none'; }

  document.getElementById('inc-pagination').innerHTML = total > PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="_incPage--;renderIncPage()" ${_incPage<=1?'disabled':''}>← Prev</button>
      <span>Page ${_incPage} of ${pages} · ${total} entries</span>
      <button onclick="_incPage++;renderIncPage()" ${_incPage>=pages?'disabled':''}>Next →</button>
    </div>` : '';
}

function showIncomeEntryModal(row=null) {
  _editIncomeId = row?.id || null;
  document.getElementById('income-modal-title').textContent = row ? 'Edit Income' : 'Add Income';
  document.getElementById('inc-date').value      = row?.date || today();
  document.getElementById('inc-amount').value    = row?.amount || '';
  document.getElementById('inc-cat').value       = row?.category || 'Rental';
  document.getElementById('inc-desc').value      = row?.description || '';
  document.getElementById('inc-notes').value     = row?.notes || '';
  document.getElementById('inc-recurring').checked = !!row?.is_recurring;
  populateAccountSel('inc-account', row?.account||'');
  document.getElementById('inc-pm').value = row?.payment_method || 'UPI';
  openModal('income-modal');
}
async function saveIncomeEntry() {
  const d = { date:document.getElementById('inc-date').value,
    amount:+document.getElementById('inc-amount').value,
    category:document.getElementById('inc-cat').value,
    account:document.getElementById('inc-account').value,
    payment_method:document.getElementById('inc-pm').value,
    description:document.getElementById('inc-desc').value,
    notes:document.getElementById('inc-notes').value,
    is_recurring:document.getElementById('inc-recurring').checked };
  if (!d.date)           { toast('Date is required','error'); return; }
  if (d.amount <= 0)     { toast('Amount must be greater than 0','error'); return; }
  try {
    if (_editIncomeId) await api(`/api/income-entries/${_editIncomeId}`,'PUT',d);
    else await api('/api/income-entries','POST',d);
    closeModal('income-modal'); await populateMonthDropdowns(); renderIncome(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delIncome(id) {
  try {
    await api(`/api/income-entries/${id}`,'DELETE');
    showUndoToast('income entry', ()=>api(`/api/income-entries/${id}/restore`,'POST'), renderIncome);
    renderIncome();
  } catch(e) { toast(e.message,'error'); }
}
async function copyIncNextMonth(id) {
  try {
    const r = await api(`/api/income-entries/${id}/copy-next-month`,'POST');
    toast(`Copied to ${r.month}`,'success'); renderIncome();
  } catch(e) { toast(e.message,'error'); }
}

/* ── EXPENSES ────────────────────────────────────────────────────────────── */
let _editExpenseId = null;

function buildExpenseFilterParams() {
  const p = new URLSearchParams();
  const v = id => document.getElementById(id)?.value || '';
  if (v('exp-month-filter'))   p.set('month',          v('exp-month-filter'));
  if (v('exp-account-filter')) p.set('account',        v('exp-account-filter'));
  if (v('exp-cat-filter'))     p.set('category',       v('exp-cat-filter'));
  if (v('exp-pm-filter'))      p.set('payment_method', v('exp-pm-filter'));
  if (v('exp-from-date'))      p.set('from_date',      v('exp-from-date'));
  if (v('exp-to-date'))        p.set('to_date',        v('exp-to-date'));
  if (v('exp-min-amt'))        p.set('min_amount',     v('exp-min-amt'));
  if (v('exp-max-amt'))        p.set('max_amount',     v('exp-max-amt'));
  if (v('exp-search'))         p.set('search',         v('exp-search'));
  return p;
}
async function applyExpFilters() { _expPage=1; await renderExpenses(); }
function clearExpFilters() {
  ['exp-search','exp-month-filter','exp-account-filter','exp-cat-filter','exp-pm-filter',
   'exp-from-date','exp-to-date','exp-min-amt','exp-max-amt'].forEach(id => {
    const el=document.getElementById(id); if(el) el.value='';
  });
  applyExpFilters();
}

async function renderExpenses() {
  const p = buildExpenseFilterParams();
  _allExpenses = await api('/api/expenses?' + p.toString());
  renderExpPage();
}

function renderExpPage() {
  const total = _allExpenses.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  if (_expPage > pages) _expPage = pages;
  const slice = _allExpenses.slice((_expPage-1)*PAGE_SIZE, _expPage*PAGE_SIZE);
  const pageTotal = slice.reduce((s,r)=>s+r.amount, 0);

  _rowCache.expenses.clear();
  slice.forEach(r => _rowCache.expenses.set(r.id, r));
  document.getElementById('exp-tbody').innerHTML = slice.map(r => {
    const splitBadge = r.is_split ? `<span class="badge" style="background:#E8F0FE;color:#1A73E8;margin-left:4px;font-size:10px">Split</span>` : '';
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const splitDetail = r.is_split && r.splits ? r.splits.map(s=>`${esc(s.category)}: ${inr(s.amount)}`).join(' · ') : '';
    return `<tr onclick="openRow('expenses',${r.id})">
      <td>${r.date}</td>
      <td>${r.description||'—'}</td>
      <td>${catBadge(r.category)}${splitBadge}${splitDetail?`<br><small style="color:var(--muted);font-size:11px">${splitDetail}</small>`:''}</td>
      <td>${acctBadge(r.account)}</td>
      <td>${pmBadge(r.payment_method)}</td>
      <td class="inr" style="font-weight:700;color:var(--exp-h)">${inr(r.amount)}</td>
      <td style="font-size:12px;color:var(--muted)">${r.notes||'—'}</td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" title="Copy to next month" onclick="copyExpNextMonth(${r.id})">📋</button>
          <button class="btn-icon btn-del" onclick="delExpense(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="empty">No expenses found.</td></tr>`;

  const tfoot = document.getElementById('exp-tfoot');
  if (total > 0) {
    tfoot.style.display=''; document.getElementById('exp-page-total').textContent=inr(pageTotal);
  } else { tfoot.style.display='none'; }

  document.getElementById('exp-pagination').innerHTML = total > PAGE_SIZE ? `
    <div class="pagination">
      <button onclick="_expPage--;renderExpPage()" ${_expPage<=1?'disabled':''}>← Prev</button>
      <span>Page ${_expPage} of ${pages} · ${total} entries</span>
      <button onclick="_expPage++;renderExpPage()" ${_expPage>=pages?'disabled':''}>Next →</button>
    </div>` : '';
}

/* ── SPLIT LOGIC ─────────────────────────────────────────────────────────── */
function toggleSplit() {
  const on  = document.getElementById('exp-split-toggle').checked;
  const sec = document.getElementById('split-section');
  const cat = document.getElementById('exp-cat');
  sec.style.display = on ? '' : 'none';
  cat.disabled = on;
  if (on && !document.getElementById('split-rows').children.length) { addSplitRow(); addSplitRow(); }
  checkSplitTotal();
}
function addSplitRow(cat='', amt='', desc='') {
  const div = document.createElement('div');
  div.className = 'split-row';
  div.innerHTML = `
    <select onchange="checkSplitTotal()">${EXP_CATS.map(c=>`<option ${c===cat?'selected':''}>${c}</option>`).join('')}</select>
    <input type="number" step="0.01" value="${amt}" placeholder="₹0" oninput="checkSplitTotal()">
    <input type="text" value="${desc}" placeholder="Note" class="split-desc">
    <button class="btn-icon btn-del" onclick="this.closest('.split-row').remove();checkSplitTotal()">✕</button>`;
  document.getElementById('split-rows').appendChild(div);
}
function checkSplitTotal() {
  const total = +document.getElementById('exp-amount').value || 0;
  const rows  = [...document.getElementById('split-rows').children];
  const alloc = rows.reduce((s,r)=>s+(+r.children[1].value||0), 0);
  const rem   = +(total - alloc).toFixed(2);
  document.getElementById('split-allocated').textContent = inr(alloc);
  document.getElementById('split-remaining').textContent = inr(rem);
  document.getElementById('split-remaining').style.color = Math.abs(rem)<0.01 ? 'var(--inc-h)' : 'var(--debt-h)';
}
function getSplits() {
  return [...document.getElementById('split-rows').children].map(r=>({
    category:r.children[0].value, amount:+r.children[1].value, description:r.children[2].value
  })).filter(s=>s.amount>0);
}

function showExpenseModal(row=null) {
  _editExpenseId = row?.id || null;
  document.getElementById('expense-modal-title').textContent = row ? 'Edit Expense' : 'Add Expense';
  document.getElementById('exp-date').value      = row?.date || today();
  document.getElementById('exp-amount').value    = row?.amount || '';
  document.getElementById('exp-cat').value       = (row?.is_split ? 'Other' : row?.category) || 'Food & Dining';
  document.getElementById('exp-cat').disabled    = !!row?.is_split;
  document.getElementById('exp-desc').value      = row?.description || '';
  document.getElementById('exp-notes').value     = row?.notes || '';
  document.getElementById('exp-recurring').checked    = !!row?.is_recurring;
  document.getElementById('exp-split-toggle').checked = !!row?.is_split;
  populateAccountSel('exp-account', row?.account||'');
  document.getElementById('exp-pm').value = row?.payment_method || 'UPI';
  document.getElementById('split-rows').innerHTML = '';
  document.getElementById('split-section').style.display = row?.is_split ? '' : 'none';
  if (row?.is_split && row?.splits) row.splits.forEach(s=>addSplitRow(s.category,s.amount,s.description||''));
  checkSplitTotal();
  openModal('expense-modal');
}
async function saveExpense() {
  const isSplit = document.getElementById('exp-split-toggle').checked;
  const splits  = isSplit ? getSplits() : [];
  const d = { date:document.getElementById('exp-date').value,
    amount:+document.getElementById('exp-amount').value,
    category:document.getElementById('exp-cat').value,
    account:document.getElementById('exp-account').value,
    payment_method:document.getElementById('exp-pm').value,
    description:document.getElementById('exp-desc').value,
    notes:document.getElementById('exp-notes').value,
    is_recurring:document.getElementById('exp-recurring').checked,
    splits };
  if (!d.date)       { toast('Date is required','error'); return; }
  if (d.amount <= 0) { toast('Amount must be greater than 0','error'); return; }
  try {
    if (_editExpenseId) await api(`/api/expenses/${_editExpenseId}`,'PUT',d);
    else await api('/api/expenses','POST',d);
    closeModal('expense-modal'); await populateMonthDropdowns(); renderExpenses(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delExpense(id) {
  try {
    await api(`/api/expenses/${id}`,'DELETE');
    showUndoToast('expense', ()=>api(`/api/expenses/${id}/restore`,'POST'), renderExpenses);
    renderExpenses();
  } catch(e) { toast(e.message,'error'); }
}
async function copyExpNextMonth(id) {
  try {
    const r = await api(`/api/expenses/${id}/copy-next-month`,'POST');
    toast(`Copied to ${r.month}`,'success'); renderExpenses();
  } catch(e) { toast(e.message,'error'); }
}

/* ── BUDGETS ─────────────────────────────────────────────────────────────── */
let _editBudgetId = null;
async function renderBudgets() {
  const month = document.getElementById('budget-month-filter').value;
  const rows  = await api('/api/budgets' + (month?`?month=${encodeURIComponent(month)}`:''));
  _rowCache.budgets.clear();
  rows.forEach(r => _rowCache.budgets.set(r.id, r));
  document.getElementById('budget-tbody').innerHTML = rows.map(r => {
    const pct  = r.pct ?? 0;
    const over = pct > 100;
    const color= over ? '#C0392B' : pct>80 ? '#E67E22' : '#1E8449';
    const barCell = month ? `<td>
      <div style="min-width:120px">
        <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>
        <small style="color:${color}">${pct}%${over?' ⚠ Over budget':''}</small>
      </div></td>` : '<td>—</td>';
    return `<tr onclick="openRow('budgets',${r.id})">
      <td>${catBadge(r.category)}</td>
      <td class="inr">${inr(r.monthly_limit)}</td>
      <td class="inr" style="color:var(--exp-h)">${month?inr(r.spent):'—'}</td>
      <td class="inr" style="color:${over?'var(--debt-h)':'var(--inc-h)'}">${month?inr(r.remaining):'—'}</td>
      ${barCell}
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" onclick="openRow('budgets',${r.id})">✏</button>
          <button class="btn-icon btn-del" onclick="delBudget(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty">No budgets set.</td></tr>`;
}
function showBudgetModal(row=null) {
  _editBudgetId = row?.id || null;
  document.getElementById('budget-modal-title').textContent = row ? 'Edit Budget' : 'Set Budget';
  document.getElementById('budget-cat').value   = row?.category || 'Food & Dining';
  document.getElementById('budget-limit').value = row?.monthly_limit || '';
  openModal('budget-modal');
}
async function saveBudget() {
  const d = { category:document.getElementById('budget-cat').value,
    monthly_limit:+document.getElementById('budget-limit').value };
  if (!d.monthly_limit || d.monthly_limit<=0) { toast('Limit must be greater than 0','error'); return; }
  try {
    if (_editBudgetId) await api(`/api/budgets/${_editBudgetId}`,'PUT',d);
    else await api('/api/budgets','POST',d);
    closeModal('budget-modal'); renderBudgets(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delBudget(id) {
  await api(`/api/budgets/${id}`,'DELETE'); renderBudgets();
}

/* ── SUBSCRIPTIONS ───────────────────────────────────────────────────────── */
let _editSubId = null;
async function renderSubscriptions() {
  const rows = await api('/api/subscriptions');
  const due  = rows.filter(r=>r.due_this_month);
  const dl   = document.getElementById('due-list');
  if (due.length) {
    dl.className='';
    dl.innerHTML = `<table class="sub-table"><thead><tr><th>Name</th><th>Amount</th><th>Billing Day</th></tr></thead><tbody>
      ${due.map(r=>`<tr><td><strong>${r.name}</strong></td><td class="inr">${inr(r.amount)}</td><td>Day ${r.billing_day}</td></tr>`).join('')}
    </tbody></table>`;
  } else {
    dl.className='empty'; dl.textContent='No subscriptions due this month.';
  }

  const total = rows.filter(r=>r.status==='active').reduce((s,r)=>s+r.monthly_equiv, 0);
  _rowCache.subs.clear();
  rows.forEach(r => _rowCache.subs.set(r.id, r));
  document.getElementById('sub-tbody').innerHTML = rows.map(r=>`
    <tr onclick="openRow('subs',${r.id})">
      <td><strong>${r.name}</strong>${r.description?`<br><small style="color:var(--muted)">${r.description}</small>`:''}</td>
      <td class="inr">${inr(r.amount)}</td>
      <td>${r.billing_cycle}</td>
      <td>Day ${r.billing_day}</td>
      <td class="inr">${inr(r.monthly_equiv)}</td>
      <td><span class="badge badge-${r.status==='active'?'active':'inactive'}">${r.status}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" onclick="openRow('subs',${r.id})">✏</button>
          <button class="btn-icon btn-del" onclick="delSub(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">No subscriptions.</td></tr>`;
  document.getElementById('sub-total-cell').textContent = inr(total) + '/month';
}
function showSubModal(row=null) {
  _editSubId = row?.id || null;
  document.getElementById('sub-modal-title').textContent = row ? 'Edit Subscription' : 'Add Subscription';
  document.getElementById('sub-name').value   = row?.name || '';
  document.getElementById('sub-amount').value = row?.amount || '';
  document.getElementById('sub-cycle').value  = row?.billing_cycle || 'monthly';
  document.getElementById('sub-bday').value   = row?.billing_day || 1;
  document.getElementById('sub-status').value = row?.status || 'active';
  document.getElementById('sub-desc').value   = row?.description || '';
  openModal('sub-modal');
}
async function saveSub() {
  const d = { name:document.getElementById('sub-name').value.trim(),
    amount:+document.getElementById('sub-amount').value,
    billing_cycle:document.getElementById('sub-cycle').value,
    billing_day:+document.getElementById('sub-bday').value,
    status:document.getElementById('sub-status').value,
    description:document.getElementById('sub-desc').value };
  if (!d.name)       { toast('Name is required','error'); return; }
  if (d.amount <= 0) { toast('Amount must be greater than 0','error'); return; }
  try {
    if (_editSubId) await api(`/api/subscriptions/${_editSubId}`,'PUT',d);
    else await api('/api/subscriptions','POST',d);
    closeModal('sub-modal'); renderSubscriptions(); toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delSub(id) {
  if (!confirm('Delete this subscription?')) return;
  await api(`/api/subscriptions/${id}`,'DELETE'); renderSubscriptions();
}

/* ── TRANSFERS ───────────────────────────────────────────────────────────── */
let _editTransferId = null;
async function renderTransfers(month='') {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  const rows = await api('/api/transfers'+qs);
  _rowCache.transfers.clear();
  rows.forEach(r => _rowCache.transfers.set(r.id, r));
  document.getElementById('tr-tbody').innerHTML = rows.map(r=>`
    <tr onclick="openRow('transfers',${r.id})">
      <td>${r.date}</td>
      <td>${acctBadge(r.from_account)}</td>
      <td>${acctBadge(r.to_account)}</td>
      <td>${pmBadge(r.payment_method)}</td>
      <td class="inr" style="font-weight:700">${inr(r.amount)}</td>
      <td style="color:var(--muted);font-size:12px">${r.description||'—'}</td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn-icon" onclick="openRow('transfers',${r.id})">✏</button>
          <button class="btn-icon btn-del" onclick="delTransfer(${r.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">No transfers.</td></tr>`;
}
function showTransferModal(row=null) {
  _editTransferId = row?.id || null;
  document.getElementById('transfer-modal-title').textContent = row ? 'Edit Transfer' : 'Add Transfer';
  document.getElementById('tr-date').value   = row?.date || today();
  document.getElementById('tr-amount').value = row?.amount || '';
  document.getElementById('tr-pm').value     = row?.payment_method || 'IMPS';
  document.getElementById('tr-desc').value   = row?.description || '';
  document.getElementById('tr-notes').value  = row?.notes || '';
  populateAccountSel('tr-from', row?.from_account||'');
  populateAccountSel('tr-to',   row?.to_account||'');
  openModal('transfer-modal');
}
async function saveTransfer() {
  const d = { date:document.getElementById('tr-date').value,
    from_account:document.getElementById('tr-from').value,
    to_account:document.getElementById('tr-to').value,
    amount:+document.getElementById('tr-amount').value,
    payment_method:document.getElementById('tr-pm').value,
    description:document.getElementById('tr-desc').value,
    notes:document.getElementById('tr-notes').value };
  if (!d.date)       { toast('Date is required','error'); return; }
  if (d.amount <= 0) { toast('Amount must be greater than 0','error'); return; }
  try {
    if (_editTransferId) await api(`/api/transfers/${_editTransferId}`,'PUT',d);
    else await api('/api/transfers','POST',d);
    closeModal('transfer-modal');
    renderTransfers(document.getElementById('tr-month-filter').value);
    toast('Saved!','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delTransfer(id) {
  try {
    const month = document.getElementById('tr-month-filter').value;
    await api(`/api/transfers/${id}`,'DELETE');
    showUndoToast('transfer', ()=>api(`/api/transfers/${id}/restore`,'POST'), ()=>renderTransfers(month));
    renderTransfers(month);
  } catch(e) { toast(e.message,'error'); }
}

/* ── REPORT ──────────────────────────────────────────────────────────────── */
async function renderReport(month) {
  if (!month) { document.getElementById('report-container').innerHTML=''; return; }
  const d = await api(`/api/report?month=${encodeURIComponent(month)}`);
  const rr = (label, val, cls='') =>
    `<div class="r-row"><span>${label}</span><span class="r-val${cls?' '+cls:''}">${inr(val)}</span></div>`;

  const incomeSection = `<div class="report-section r-income"><h3>Income</h3>
    ${Object.entries(d.income_by_category).map(([k,v])=>rr(k,v)).join('')}
    ${rr('Total Income', d.income_total,'pos r-total')}</div>`;

  const debtSection = `<div class="report-section r-debt"><h3>Obligations</h3>
    ${Object.entries(d.debt).map(([k,v])=>rr(k,v)).join('')}
    ${rr('Total Obligations', d.debt_total,'neg r-total')}</div>`;

  const expSection = `<div class="report-section r-exp"><h3>Expenses by Category</h3>
    ${Object.entries(d.expenses_by_category).map(([k,v])=>rr(k,v)).join('')}
    ${rr('Total Expenses', d.total_expenses,'neg r-total')}</div>`;

  const accSection = `<div class="report-section r-acc"><h3>Account Balances</h3>
    ${Object.entries(d.account_summary).map(([acc,v])=>`
      <div class="r-row"><span>${acc}</span>
        <span class="r-val">${inr(v.opening)} → <strong style="color:${v.closing<0?'var(--debt-h)':'var(--inc-h)'}">${inr(v.closing)}</strong></span>
      </div>`).join('')}
  </div>`;

  const net = d.net;
  const netSection = `<div class="report-section r-net"><h3>Net Summary — ${month}</h3>
    <div class="r-row r-net-row"><span>Income</span><span class="r-val pos">${inr(d.income_total)}</span></div>
    <div class="r-row r-net-row"><span>Obligations</span><span class="r-val neg">−${inr(d.debt_total)}</span></div>
    <div class="r-row r-net-row"><span>Expenses</span><span class="r-val neg">−${inr(d.total_expenses)}</span></div>
    <div class="r-row r-total r-net-row"><span>Net</span><span class="r-val ${net>=0?'pos':'neg'}">${inr(net)}</span></div>
  </div>`;

  document.getElementById('report-container').innerHTML =
    `<div class="report-grid">${incomeSection}${debtSection}${expSection}${accSection}${netSection}</div>`;
}

/* ── CSV IMPORT ──────────────────────────────────────────────────────────── */
function showImportModal(type) {
  _importType = type; _importRows = [];
  document.getElementById('import-modal-title').textContent =
    `Import ${type==='income'?'Income':'Expenses'} CSV`;
  document.getElementById('import-csv').value = '';
  document.getElementById('import-preview').textContent = '';
  document.getElementById('import-confirm-btn').style.display = 'none';
  document.getElementById('import-file').value = '';
  openModal('import-modal');
}
function loadImportFile() {
  const f = document.getElementById('import-file').files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => { document.getElementById('import-csv').value = e.target.result; };
  r.readAsText(f);
}
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^["']|["']$/g,'').toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)/g) || [];
    const obj = {};
    headers.forEach((h,i)=>{ obj[h]=(vals[i]||'').replace(/^"|"$/g,'').trim(); });
    return obj;
  });
}
function previewImport() {
  const text = document.getElementById('import-csv').value.trim();
  if (!text) { toast('Paste some CSV first','error'); return; }
  _importRows = parseCSV(text);
  const prev = document.getElementById('import-preview');
  if (!_importRows.length) { prev.textContent='Could not parse any rows.'; return; }
  const ok  = _importRows.filter(r=>r.date&&r.amount&&+r.amount>0).length;
  const bad = _importRows.length - ok;
  prev.innerHTML = `<strong>${ok}</strong> valid rows ready.${bad?` <span style="color:var(--debt-h)">${bad} rows skipped (missing date or amount).</span>`:''}`;
  document.getElementById('import-confirm-btn').style.display = ok>0?'':'none';
}
async function confirmImport() {
  const rows = _importRows.filter(r=>r.date&&r.amount&&+r.amount>0);
  const ep   = _importType==='income' ? '/api/import/income' : '/api/import/expenses';
  try {
    const r = await api(ep,'POST',{rows});
    closeModal('import-modal');
    await populateMonthDropdowns();
    if (_importType==='income') renderIncome(); else renderExpenses();
    toast(`Imported ${r.imported} rows!`, 'success');
    if (r.errors?.length) toast(`${r.errors.length} rows had errors`,'error');
  } catch(e) { toast(e.message,'error'); }
}

/* ── EMI CALCULATOR ──────────────────────────────────────────────────────── */
function calcEMI() {
  const P = +document.getElementById('emi-p').value;
  const rAnnual = +document.getElementById('emi-r').value;
  const r = rAnnual / 12 / 100;
  const n = +document.getElementById('emi-n').value;
  if (!P || !n) {
    ['emi-result','emi-interest','emi-total'].forEach(id=>document.getElementById(id).value=''); return;
  }
  const emi = r === 0 ? P / n : P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const tot = emi * n;
  document.getElementById('emi-result').value   = inr(emi);
  document.getElementById('emi-interest').value = inr(tot - P);
  document.getElementById('emi-total').value    = inr(tot);
}

/* ── UTILS ───────────────────────────────────────────────────────────────── */
function today() { return new Date().toISOString().split('T')[0]; }

/* ── INIT ────────────────────────────────────────────────────────────────── */
async function init() {
  applyTheme();
  await loadAccounts();
  await loadDebtCreditors();
  await populateMonthDropdowns();
  switchTab('dashboard');
}

checkAuth().then(authed => { if (authed) init(); });
