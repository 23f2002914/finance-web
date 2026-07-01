import { useQuery } from '@tanstack/react-query'
import { getTransfers } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function TransfersTab() {
  const { data: transfers = [], isLoading, error } = useQuery({ queryKey: ['transfers'], queryFn: () => getTransfers() })
  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = transfers.reduce((s: number, t: any) => s + Number(t.amount), 0)
  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">🔄 Transfers</h1>
        <p className="text-sm text-slate-400">Between your accounts</p>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Transferred</div>
        <div className="text-3xl font-bold text-cyan-300">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{transfers.length} transfers</div>
      </div>
      {transfers.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No transfers recorded yet</p></div>
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">From</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">To</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Amount</th>
            </tr></thead>
            <tbody>
              {transfers.map((t: any, i: number) => (
                <tr key={t.id || i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{t.date}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 font-medium">{t.from_account}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 font-medium">{t.to_account}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-right font-semibold text-blue-300">{inr(Number(t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
