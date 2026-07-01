import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { EntityForm, Field } from '../components/EntityForm'

export function AccountsTab() {
  const qc = useQueryClient()
  const { data: accounts = [], isLoading, error } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [editing, setEditing] = useState<any>(null)

  const save = useMutation({
    mutationFn: (v: any) => (editing && editing !== 'new' ? updateAccount(editing.id, v) : createAccount(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null) },
  })
  const del = useMutation({ mutationFn: (id: number) => deleteAccount(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) } })

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = accounts.reduce((s: number, a: any) => s + Number(a.closing_balance), 0)
  const fields: Field[] = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Kotak' },
    { name: 'account_type', label: 'Type', type: 'select', options: [{ value: 'Bank', label: 'Bank' }, { value: 'Wallet', label: 'Wallet' }, { value: 'Cash', label: 'Cash' }] },
    { name: 'sort_order', label: 'Sort Order', type: 'number' },
    { name: 'notes', label: 'Notes', type: 'text' },
    { name: 'active', label: 'Active', type: 'checkbox' },
  ]

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">🏦 Bank Accounts</h1>
          <p className="text-sm text-slate-400">Your accounts and balances</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:shadow-lg active:scale-95 transition-all">＋ Add Account</button>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Balance</div>
        <div className="text-3xl font-bold text-cyan-300">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{accounts.length} accounts</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((a: any) => {
          const icon = a.account_type === 'Bank' ? '🏦' : a.account_type === 'Wallet' ? '👝' : '💵'
          return (
            <div key={a.id} className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-6 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div><h3 className="text-xl font-semibold text-slate-50">{a.name}</h3><p className="text-xs text-slate-500">{a.account_type}</p></div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${a.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/40 text-slate-300'}`}>{a.active ? 'Active' : 'Inactive'}</span>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(a)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-700/50">✎</button>
                    <button onClick={() => { if (confirm('Delete this account? Its transactions may be affected.')) del.mutate(a.id) }} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700/50">🗑</button>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Closing Balance</p>
                <p className="text-2xl font-bold text-cyan-300">{inr(Number(a.closing_balance))}</p>
              </div>
            </div>
          )
        })}
      </div>
      {editing && (
        <EntityForm title={editing === 'new' ? 'Add Account' : 'Edit Account'} fields={fields}
          initial={editing === 'new' ? { account_type: 'Bank', sort_order: 99, active: true } : editing}
          submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
