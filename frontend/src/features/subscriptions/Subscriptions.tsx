import { useQuery } from '@tanstack/react-query'
import { getSubscriptions } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function SubscriptionsTab() {
  const { data: subs = [], isLoading, error } = useQuery({ queryKey: ['subscriptions'], queryFn: getSubscriptions })
  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = subs.reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">📺 Subscriptions</h1>
        <p className="text-sm text-slate-400">Recurring payments</p>
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
            <div key={s.id} className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-6 hover:scale-[1.02] transform transition-transform">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-semibold text-slate-50">{s.name}</h3>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300">{s.billing_cycle}</span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{s.description || 'No description'}</p>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Monthly Cost</p>
                <p className="text-2xl font-bold text-purple-300">{inr(Number(s.amount))}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
