import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTransfers, getAccounts, createTransfer, updateTransfer, deleteTransfer } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { EntityForm, RowActions, Field } from '../components/EntityForm'

const PM = ['IMPS', 'UPI', 'NEFT', 'RTGS', 'Net Banking', 'Cash']
const todayISO = () => new Date().toISOString().slice(0, 10)

export function TransfersTab() {
  const qc = useQueryClient()
  const { data: transfers = [], isLoading, error } = useQuery({ queryKey: ['transfers'], queryFn: () => getTransfers() })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [editing, setEditing] = useState<any>(null)

  const save = useMutation({
    mutationFn: (v: any) => { if (v.from_account === v.to_account) throw new Error('From and To must differ'); return editing && editing !== 'new' ? updateTransfer(editing.id, v) : createTransfer(v) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null) },
  })
  const del = useMutation({ mutationFn: (id: number) => deleteTransfer(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) } })

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = transfers.reduce((s: number, t: any) => s + Number(t.amount), 0)
  const acctOpts = accounts.map((a: any) => ({ value: a.name, label: a.name }))
  const fields: Field[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'from_account', label: 'From Account', type: 'select', required: true, options: acctOpts },
    { name: 'to_account', label: 'To Account', type: 'select', required: true, options: acctOpts },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'payment_method', label: 'Method', type: 'select', options: PM.map((p) => ({ value: p, label: p })) },
    { name: 'description', label: 'Description', type: 'text' },
  ]

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">🔄 Transfers</h1>
          <p className="text-sm text-slate-400">Between your accounts</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:shadow-lg active:scale-95 transition-all">＋ Add Transfer</button>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Transferred</div>
        <div className="text-3xl font-bold text-cyan-300">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{transfers.length} transfers</div>
      </div>
      {transfers.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No transfers yet</p></div>
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">From</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">To</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Actions</th>
            </tr></thead>
            <tbody>
              {transfers.map((t: any, i: number) => (
                <tr key={t.id || i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{t.date}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 font-medium">{t.from_account}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 font-medium">{t.to_account}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-right font-semibold text-blue-300">{inr(Number(t.amount))}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-right"><RowActions onEdit={() => setEditing(t)} onDelete={() => { if (confirm('Delete this transfer?')) del.mutate(t.id) }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EntityForm title={editing === 'new' ? 'Add Transfer' : 'Edit Transfer'} fields={fields}
          initial={editing === 'new' ? { date: todayISO(), payment_method: 'IMPS' } : editing}
          submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
