import { useQuery } from '@tanstack/react-query'
import { getIncome } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function IncomeTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ['income'], queryFn: () => getIncome() })
  if (isLoading) return <LoadingState />
  if (error) return <ErrorBox msg={(error as Error).message} />

  const income = data?.data || []
  const total = income.reduce((s: number, i: any) => s + Number(i.amount), 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💰 Income</h1>
        <p className="text-sm text-slate-400">Track your earnings</p>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Income</div>
        <div className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-200 bg-clip-text text-transparent">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{income.length} transactions</div>
      </div>
      {income.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">No income recorded yet</p></div>
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Description</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Category</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50">Amount</th>
            </tr></thead>
            <tbody>
              {income.map((i: any, idx: number) => (
                <tr key={i.id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{i.date}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300">{i.description || '—'}</td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm"><span className="inline-block px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs">{i.category}</span></td>
                  <td className="px-6 py-4 border-b border-slate-700/30 text-sm text-right font-semibold text-emerald-300">{inr(Number(i.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
function ErrorBox({ msg }: any) { return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{msg}</p></div> }
