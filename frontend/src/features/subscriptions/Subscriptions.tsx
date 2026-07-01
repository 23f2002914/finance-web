import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { EntityForm, Field } from '../components/EntityForm'

export function SubscriptionsTab() {
  const qc = useQueryClient()
  const { data: subs = [], isLoading, error } = useQuery({ queryKey: ['subscriptions'], queryFn: getSubscriptions })
  const [editing, setEditing] = useState<any>(null)

  const save = useMutation({
    mutationFn: (v: any) => (editing && editing !== 'new' ? updateSubscription(editing.id, v) : createSubscription(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setEditing(null) },
  })
  const del = useMutation({ mutationFn: (id: number) => deleteSubscription(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) } })

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = subs.reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
  const fields: Field[] = [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Netflix' },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'description', label: 'Description', type: 'text' },
    { name: 'billing_day', label: 'Billing Day (1-31)', type: 'number' },
    { name: 'billing_cycle', label: 'Cycle', type: 'select', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }] },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ]

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">📺 Subscriptions</h1>
          <p className="text-sm text-slate-400">Recurring payments</p>
        </div>
        <button onClick={() => setEditing('new')} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:shadow-lg active:scale-95 transition-all">＋ Add Subscription</button>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Total</div>
        <div className="text-3xl font-bold text-purple-300">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{subs.length} active subscriptions</div>
      </div>
      {subs.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No subscriptions yet</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subs.map((s: any) => (
            <div key={s.id} className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-6 group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-semibold text-slate-50">{s.name}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(s)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-700/50">✎</button>
                  <button onClick={() => { if (confirm('Delete this subscription?')) del.mutate(s.id) }} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700/50">🗑</button>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">{s.description || 'No description'}</p>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Monthly Cost · {s.billing_cycle}</p>
                <p className="text-2xl font-bold text-purple-300">{inr(Number(s.amount))}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <EntityForm title={editing === 'new' ? 'Add Subscription' : 'Edit Subscription'} fields={fields}
          initial={editing === 'new' ? { billing_cycle: 'monthly', status: 'active', billing_day: 1 } : editing}
          submitting={save.isPending} onSubmit={(v) => save.mutate(v)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
