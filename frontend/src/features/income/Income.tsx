import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function IncomeTab() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['income'],
    queryFn: () => api('/income-entries'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div className="text-center py-12">Loading income...</div>

  if (!result) return <div className="text-center py-12 text-slate-400">No data available</div>

  const income = result?.data || []
  const total = income.reduce((sum: number, i: any) => sum + i.amount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-header">💰 Income</h1>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Income</div>
        <div className="stat-value stat-income">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-2">{income.length} transactions</div>
      </div>

      {income.length === 0 ? (
        <div className="card-lg text-center py-12">
          <p className="text-slate-400">No income recorded yet</p>
        </div>
      ) : (
        <div className="card-lg overflow-x-auto">
          <h2 className="text-lg font-bold mb-4 text-slate-50">Recent Transactions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">Date</th>
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">Description</th>
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">Category</th>
                <th className="text-right py-3 px-4 text-slate-300 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {income.slice(0, 50).map((i: any, idx: number) => (
                <tr key={i.id || idx} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="py-3 px-4 text-slate-300">{i.date}</td>
                  <td className="py-3 px-4 text-slate-300">{i.description || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-200">{i.category}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-300">{inr(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
