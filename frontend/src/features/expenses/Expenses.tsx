import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, getAccounts, createExpense, updateExpense, deleteExpense, currentMonth } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { EntityForm, RowActions, Field } from '../components/EntityForm'

const PM = ['UPI', 'Card-Debit', 'Card-Credit', 'Cash', 'Net Banking', 'Cheque']
const todayISO = () => new Date().toISOString().slice(0, 10)

export function ExpensesTab() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['expenses'], queryFn: () => getExpenses() })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [editing, setEditing] = useState<any>(null) // object = edit, 'new' = create, null = closed

  const save = useMutation({
    mutationFn: (v: any) => (editing && editing !== 'new' ? updateExpense(editing.id, v) : createExpense(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null) },
  })
  const del = useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorBox msg={(error as Error).message} />

  const expenses = data?.data || []
  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  const fields: Field[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'description', label: 'Description', type: 'text', placeholder: 'e.g. Groceries' },
    { name: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Food & Dining' },
    { name: 'account', label: 'Account', type: 'select', required: true, options: accounts.map((a: any) => ({ value: a.name, label: a.name })) },
    { name: 'payment_method', label: 'Payment Method', type: 'select', options: PM.map((p) => ({ value: p, label: p })) },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'notes', label: 'Notes', type: 'text' },
  ]

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💸 Expenses</h1>
          <p className="text-sm text-slate-400">Track your spending</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:shadow-lg active:scale-95 transition-all">＋ Add Expense</button>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Expenses</div>
        <div className="text-3xl font-bold bg-gradient-to-r from-orange-300 to-orange-200 bg-clip-text text-transparent">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{expenses.length} transactions</div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No expenses yet — add your first one</p></div>
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <Th>Date</Th><Th>Description</Th><Th>Category</Th><Th right>Amount</Th><Th right>Actions</Th>
            </tr></thead>
            <tbody>
              {expenses.map((e: any, i: number) => (
                <tr key={e.id || i} className="hover:bg-slate-800/30 transition-colors">
                  <Td>{e.date}</Td><Td>{e.description || '—'}</Td>
                  <Td><span className="inline-block px-2 py-1 rounded bg-slate-700/40 text-slate-200 text-xs">{e.category}</span></Td>
                  <Td right className="font-semibold text-orange-300">{inr(Number(e.amount))}</Td>
                  <Td right><RowActions onEdit={() => setEditing(e)} onDelete={() => { if (confirm('Delete this expense?')) del.mutate(e.id) }} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing === 'new' ? 'Add Expense' : 'Edit Expense'}
          fields={fields}
          initial={editing === 'new' ? { date: todayISO(), payment_method: 'UPI', account: accounts[0]?.name } : editing}
          submitting={save.isPending}
          onSubmit={(v) => save.mutate(v)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Th({ children, right }: any) { return <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50 ${right ? 'text-right' : 'text-left'}`}>{children}</th> }
function Td({ children, right, className = '' }: any) { return <td className={`px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 ${right ? 'text-right' : ''} ${className}`}>{children}</td> }
function ErrorBox({ msg }: any) { return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{msg}</p></div> }
