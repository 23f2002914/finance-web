import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncome, getAccounts, createIncome, updateIncome, deleteIncome } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { EntityForm, RowActions, Field } from '../components/EntityForm'

const PM = ['UPI', 'Card-Debit', 'Card-Credit', 'Cash', 'Net Banking', 'Cheque']
const todayISO = () => new Date().toISOString().slice(0, 10)

export function IncomeTab() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['income'], queryFn: () => getIncome() })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [editing, setEditing] = useState<any>(null)

  const save = useMutation({
    mutationFn: (v: any) => (editing && editing !== 'new' ? updateIncome(editing.id, v) : createIncome(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null) },
  })
  const del = useMutation({
    mutationFn: (id: number) => deleteIncome(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const income = data?.data || []
  const total = income.reduce((s: number, i: any) => s + Number(i.amount), 0)
  const fields: Field[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'description', label: 'Description', type: 'text', placeholder: 'e.g. Salary' },
    { name: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Salary' },
    { name: 'account', label: 'Account', type: 'select', required: true, options: accounts.map((a: any) => ({ value: a.name, label: a.name })) },
    { name: 'payment_method', label: 'Payment Method', type: 'select', options: PM.map((p) => ({ value: p, label: p })) },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'notes', label: 'Notes', type: 'text' },
  ]

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💰 Income</h1>
          <p className="text-sm text-slate-400">Track your earnings</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:shadow-lg active:scale-95 transition-all">＋ Add Income</button>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Income</div>
        <div className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-200 bg-clip-text text-transparent">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{income.length} transactions</div>
      </div>
      {income.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No income yet — add your first entry</p></div>
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Description</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Category</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Actions</th>
            </tr></thead>
            <tbody>
              {income.map((i: any, idx: number) => (
                <tr key={i.id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{i.date}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{i.description || '—'}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm"><span className="inline-block px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs">{i.category}</span></td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-right font-semibold text-emerald-300">{inr(Number(i.amount))}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-right"><RowActions onEdit={() => setEditing(i)} onDelete={() => { if (confirm('Delete this income entry?')) del.mutate(i.id) }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EntityForm title={editing === 'new' ? 'Add Income' : 'Edit Income'} fields={fields}
          initial={editing === 'new' ? { date: todayISO(), payment_method: 'UPI', account: accounts[0]?.name } : editing}
          submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
