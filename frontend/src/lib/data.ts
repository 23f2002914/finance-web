// Direct Supabase data layer — reads straight from Postgres/PostgREST.
// No dependency on the Flask/Render backend, so no cold-start or deploy-lag issues.
import { supabase } from './supabaseClient'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function currentMonth(): string {
  const d = new Date()
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function monthKey(m: string): number {
  const [mon, year] = m.split(' ')
  return parseInt(year, 10) * 100 + (MONTHS.indexOf(mon) + 1)
}

type AccSummaryRow = {
  account: string
  opening: number
  income: number
  transfers_in: number
  transfers_out: number
  expenses: number
  closing: number
}

async function accSummary(month: string | null): Promise<Record<string, AccSummaryRow>> {
  const { data, error } = await supabase.rpc('acc_summary', { p_month: month })
  if (error) throw error
  const map: Record<string, AccSummaryRow> = {}
  for (const row of (data || []) as AccSummaryRow[]) map[row.account] = row
  return map
}

export async function getAccounts() {
  const [{ data: accounts, error }, summary] = await Promise.all([
    supabase.from('bank_accounts').select('*').order('sort_order'),
    accSummary(null),
  ])
  if (error) throw error
  return (accounts || []).map((a: any) => ({
    ...a,
    closing_balance: summary[a.name]?.closing ?? 0,
  }))
}

export async function getDashboard() {
  const month = currentMonth()
  const [{ data: accounts, error: accErr }, alltime, monthly, subTotal, { data: expRows, error: expErr }] =
    await Promise.all([
      supabase.from('bank_accounts').select('*').order('sort_order'),
      accSummary(null),
      accSummary(month),
      supabase.rpc('sub_monthly_total'),
      supabase.from('expenses').select('category, amount').eq('deleted', false).eq('month', month),
    ])
  if (accErr) throw accErr
  if (expErr) throw expErr

  const expenses_by_category: Record<string, number> = {}
  for (const e of expRows || []) {
    expenses_by_category[e.category] = (expenses_by_category[e.category] || 0) + Number(e.amount)
  }

  return {
    month,
    accounts: accounts || [],
    alltime,
    monthly,
    subscription_total: Number((subTotal as any)?.data ?? 0),
    expenses_by_category,
  }
}

export async function getExpenses(month?: string) {
  let q = supabase.from('expenses').select('*').eq('deleted', false).order('date', { ascending: false })
  if (month) q = q.eq('month', month)
  const { data, error } = await q
  if (error) throw error
  return { data: data || [], total: (data || []).length }
}

export async function getIncome(month?: string) {
  let q = supabase.from('income_entries').select('*').eq('deleted', false).order('date', { ascending: false })
  if (month) q = q.eq('month', month)
  const { data, error } = await q
  if (error) throw error
  return { data: data || [], total: (data || []).length }
}

export async function getTransfers(month?: string) {
  let q = supabase.from('transfers').select('*').eq('deleted', false).order('date', { ascending: false })
  if (month) q = q.eq('month', month)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('deleted', false)
    .eq('status', 'active')
    .order('name')
  if (error) throw error
  return data || []
}

export async function getMonths(): Promise<string[]> {
  const [exp, inc, tr] = await Promise.all([
    supabase.from('expenses').select('month').eq('deleted', false),
    supabase.from('income_entries').select('month').eq('deleted', false),
    supabase.from('transfers').select('month').eq('deleted', false),
  ])
  const set = new Set<string>()
  for (const r of [...(exp.data || []), ...(inc.data || []), ...(tr.data || [])]) {
    if (r.month) set.add(r.month)
  }
  set.add(currentMonth())
  return Array.from(set).sort((a, b) => monthKey(b) - monthKey(a))
}

export async function getDebts() {
  const [{ data: entries, error: eErr }, { data: creditors, error: cErr }, subTotal] = await Promise.all([
    supabase.from('debt_entries').select('*').order('month'),
    supabase.from('debt_creditors').select('*').eq('active', true).order('sort_order'),
    supabase.rpc('sub_monthly_total'),
  ])
  if (eErr) throw eErr
  if (cErr) throw cErr

  const subs = Number((subTotal as any)?.data ?? 0)
  const creditorList = (creditors || []).map((c: any) => ({ id: c.id, name: c.name }))

  const byMonth: Record<string, any> = {}
  for (const en of entries || []) {
    if (!byMonth[en.month]) {
      byMonth[en.month] = {
        month: en.month,
        creditors: creditorList,
        entries: {},
        subscriptions: subs,
        total: 0,
      }
    }
    byMonth[en.month].entries[en.creditor_id] = en
    byMonth[en.month].total += Number(en.amount)
  }
  for (const m of Object.keys(byMonth)) byMonth[m].total += subs

  return Object.values(byMonth).sort((a: any, b: any) => monthKey(b.month) - monthKey(a.month))
}

export async function getReport(month: string) {
  const [{ data: exp }, { data: inc }, summary] = await Promise.all([
    supabase.from('expenses').select('category, amount').eq('deleted', false).eq('month', month),
    supabase.from('income_entries').select('category, amount').eq('deleted', false).eq('month', month),
    accSummary(month),
  ])
  const expenses_by_category: Record<string, number> = {}
  let total_expenses = 0
  for (const e of exp || []) {
    expenses_by_category[e.category] = (expenses_by_category[e.category] || 0) + Number(e.amount)
    total_expenses += Number(e.amount)
  }
  const income_by_category: Record<string, number> = {}
  let total_income = 0
  for (const i of inc || []) {
    income_by_category[i.category] = (income_by_category[i.category] || 0) + Number(i.amount)
    total_income += Number(i.amount)
  }
  return { month, total_income, total_expenses, expenses_by_category, income_by_category, accounts: summary }
}

export async function payDebt(id: number, totalAmount: number, newPaidTotal: number) {
  const paid = Math.max(0, newPaidTotal)
  const status = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  const { error } = await supabase
    .from('debt_entries')
    .update({
      amount_paid: paid,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

// ---------- Month helper for writes ----------
export function dateToMonth(dateStr: string): string {
  // dateStr = 'YYYY-MM-DD'
  const [y, m] = dateStr.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

// ---------- Expenses CRUD ----------
export async function createExpense(v: any) {
  const { error } = await supabase.from('expenses').insert({
    date: v.date, description: v.description || '', category: v.category || 'Other',
    account: v.account, payment_method: v.payment_method || 'UPI', amount: Number(v.amount),
    month: dateToMonth(v.date), notes: v.notes || '', is_recurring: false, is_split: false, deleted: false,
  })
  if (error) throw error
}
export async function updateExpense(id: number, v: any) {
  const patch: any = { description: v.description || '', category: v.category || 'Other',
    account: v.account, payment_method: v.payment_method || 'UPI', amount: Number(v.amount), notes: v.notes || '' }
  if (v.date) { patch.date = v.date; patch.month = dateToMonth(v.date) }
  const { error } = await supabase.from('expenses').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteExpense(id: number) {
  const { error } = await supabase.from('expenses').update({ deleted: true }).eq('id', id)
  if (error) throw error
}

// ---------- Income CRUD ----------
export async function createIncome(v: any) {
  const { error } = await supabase.from('income_entries').insert({
    date: v.date, description: v.description || '', category: v.category || 'Other',
    account: v.account, payment_method: v.payment_method || 'UPI', amount: Number(v.amount),
    month: dateToMonth(v.date), notes: v.notes || '', is_recurring: false, deleted: false,
  })
  if (error) throw error
}
export async function updateIncome(id: number, v: any) {
  const patch: any = { description: v.description || '', category: v.category || 'Other',
    account: v.account, payment_method: v.payment_method || 'UPI', amount: Number(v.amount), notes: v.notes || '' }
  if (v.date) { patch.date = v.date; patch.month = dateToMonth(v.date) }
  const { error } = await supabase.from('income_entries').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteIncome(id: number) {
  const { error } = await supabase.from('income_entries').update({ deleted: true }).eq('id', id)
  if (error) throw error
}

// ---------- Transfers CRUD ----------
export async function createTransfer(v: any) {
  const { error } = await supabase.from('transfers').insert({
    date: v.date, from_account: v.from_account, to_account: v.to_account, amount: Number(v.amount),
    payment_method: v.payment_method || 'IMPS', description: v.description || '', notes: v.notes || '',
    month: dateToMonth(v.date), deleted: false,
  })
  if (error) throw error
}
export async function updateTransfer(id: number, v: any) {
  const patch: any = { from_account: v.from_account, to_account: v.to_account, amount: Number(v.amount),
    payment_method: v.payment_method || 'IMPS', description: v.description || '', notes: v.notes || '' }
  if (v.date) { patch.date = v.date; patch.month = dateToMonth(v.date) }
  const { error } = await supabase.from('transfers').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteTransfer(id: number) {
  const { error } = await supabase.from('transfers').update({ deleted: true }).eq('id', id)
  if (error) throw error
}

// ---------- Subscriptions CRUD ----------
export async function createSubscription(v: any) {
  const { error } = await supabase.from('subscriptions').insert({
    name: v.name, amount: Number(v.amount), description: v.description || '',
    status: v.status || 'active', billing_day: Number(v.billing_day) || 1,
    billing_cycle: v.billing_cycle || 'monthly', deleted: false,
  })
  if (error) throw error
}
export async function updateSubscription(id: number, v: any) {
  const { error } = await supabase.from('subscriptions').update({
    name: v.name, amount: Number(v.amount), description: v.description || '',
    status: v.status || 'active', billing_day: Number(v.billing_day) || 1,
    billing_cycle: v.billing_cycle || 'monthly',
  }).eq('id', id)
  if (error) throw error
}
export async function deleteSubscription(id: number) {
  const { error } = await supabase.from('subscriptions').update({ deleted: true }).eq('id', id)
  if (error) throw error
}

// ---------- Accounts CRUD ----------
export async function createAccount(v: any) {
  const { error } = await supabase.from('bank_accounts').insert({
    name: v.name, account_type: v.account_type || 'Bank', notes: v.notes || '',
    sort_order: Number(v.sort_order) || 99, active: v.active !== false,
  })
  if (error) throw error
}
export async function updateAccount(id: number, v: any) {
  const { error } = await supabase.from('bank_accounts').update({
    name: v.name, account_type: v.account_type || 'Bank', notes: v.notes || '',
    sort_order: Number(v.sort_order) || 99, active: v.active !== false,
  }).eq('id', id)
  if (error) throw error
}
export async function deleteAccount(id: number) {
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
  if (error) throw error
}
