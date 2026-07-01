import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDebts, payDebt } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function DebtsTab() {
  const { data: debts = [], isLoading, error } = useQuery({ queryKey: ['debts'], queryFn: getDebts })
  const qc = useQueryClient()
  const pay = useMutation({
    mutationFn: ({ id, totalAmount, newPaidTotal }: any) => payDebt(id, totalAmount, newPaidTotal),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialog, setDialog] = useState<any>(null)

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const totalDebt = debts.reduce((s: number, m: any) => s + (m.total || 0), 0)
  const paidCount = debts.reduce((c: number, m: any) => c + Object.values(m.entries || {}).filter((e: any) => e.status === 'paid').length, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💳 Debts & Liabilities</h1>
        <p className="text-sm text-slate-400">Track what you owe</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6"><div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Debt</div><div className="text-3xl font-bold text-red-300">{inr(totalDebt)}</div><div className="text-xs text-slate-500 mt-1">{debts.length} months</div></div>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6"><div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Fully Paid</div><div className="text-3xl font-bold text-emerald-300">{paidCount}</div><div className="text-xs text-slate-500 mt-1">Entries settled</div></div>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6"><div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Subscriptions</div><div className="text-3xl font-bold text-purple-300">{inr(debts.reduce((s: number, m: any) => s + (m.subscriptions || 0), 0))}</div><div className="text-xs text-slate-500 mt-1">Monthly</div></div>
      </div>

      {debts.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No debts recorded 🎉</p></div>
      ) : (
        <div className="space-y-4">
          {debts.map((m: any) => (
            <div key={m.month} className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
              <button onClick={() => setExpanded(expanded === m.month ? null : m.month)} className="w-full p-6 text-left flex justify-between items-center hover:bg-slate-700/20 transition-colors group">
                <div><h3 className="text-2xl font-bold text-slate-50">{m.month}</h3><p className="text-xs text-slate-500 mt-1">Total: {inr(m.total)}</p></div>
                <div className="text-2xl group-hover:scale-110 transition-transform">{expanded === m.month ? '⬆️' : '⬇️'}</div>
              </button>
              {expanded === m.month && (
                <div className="p-6 pt-0 space-y-4">
                  {m.creditors?.map((cred: any) => {
                    const en = m.entries[cred.id]
                    if (!en) return null
                    const remaining = Number(en.amount) - Number(en.amount_paid)
                    const progress = Number(en.amount) ? (Number(en.amount_paid) / Number(en.amount)) * 100 : 0
                    const badge = en.status === 'paid' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : en.status === 'partial' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30'
                    const bar = en.status === 'paid' ? 'bg-emerald-500' : en.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <div key={cred.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div><h4 className="text-lg font-semibold text-slate-50">{cred.name}</h4><p className="text-xs text-slate-500 mt-1">Paid: {inr(Number(en.amount_paid))} / {inr(Number(en.amount))}</p></div>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${badge}`}>{en.status.toUpperCase()}</span>
                        </div>
                        <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden"><div className={`h-full transition-all duration-300 ${bar}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-sm text-slate-300">Remaining: <span className="font-bold text-red-300">{inr(remaining)}</span></span>
                          {en.status !== 'paid' && <button onClick={() => setDialog(en)} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:shadow-lg active:scale-95 transition-all">💰 Pay</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-sm w-full space-y-6">
            <div><h2 className="text-2xl font-bold text-slate-50">💳 Record Payment</h2></div>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Amount Owed:</span><span className="font-bold text-red-300">{inr(Number(dialog.amount))}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Already Paid:</span><span className="font-bold text-emerald-300">{inr(Number(dialog.amount_paid))}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-300">Remaining:</span><span className="font-bold text-yellow-300">{inr(Number(dialog.amount) - Number(dialog.amount_paid))}</span></div>
            </div>
            <div className="space-y-3">
              <button disabled={pay.isPending} onClick={() => { pay.mutate({ id: dialog.id, totalAmount: Number(dialog.amount), newPaidTotal: Number(dialog.amount) }); setDialog(null) }} className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold hover:shadow-lg active:scale-95 transition-all">✅ Mark Fully Paid</button>
              <button disabled={pay.isPending} onClick={() => { const a = prompt('Enter payment amount:'); if (a && !isNaN(Number(a))) { pay.mutate({ id: dialog.id, totalAmount: Number(dialog.amount), newPaidTotal: Number(dialog.amount_paid) + Number(a) }) } setDialog(null) }} className="w-full py-2.5 rounded-lg border border-slate-600 text-slate-200 font-medium hover:bg-slate-700/50 transition-all">💰 Partial Payment</button>
              <button onClick={() => setDialog(null)} className="w-full py-2.5 rounded-lg text-slate-300 hover:bg-slate-700/30 transition-all">✖️ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
