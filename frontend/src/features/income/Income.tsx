import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function IncomeTab() {
  const { data: result, isLoading, error } = useQuery({
    queryKey: ['income'],
    queryFn: () => api('/income-entries'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load income</div>
  if (!result) return null

  const income = result?.data || []
  const total = income.reduce((sum: number, i: any) => sum + i.amount, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">💰 Income</h1>
        <p className="body-sm">Track your earnings</p>
      </div>

      <div className="stat-card stat-card-income">
        <div className="stat-label">Total Income</div>
        <div className="stat-value">{inr(total)}</div>
        <div className="stat-subtext">{income.length} transactions</div>
      </div>

      {income.length === 0 ? (
        <div className="surface-lg text-center py-16">
          <p className="text-slate-400 text-lg">No income recorded yet</p>
          <p className="caption mt-2">Your earnings will appear here</p>
        </div>
      ) : (
        <div className="surface-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/30">
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header">Category</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {income.slice(0, 50).map((i: any, idx: number) => (
                <tr key={i.id || idx} className="table-row">
                  <td className="table-cell text-slate-300">{i.date}</td>
                  <td className="table-cell text-slate-300">{i.description || '—'}</td>
                  <td className="table-cell">
                    <span className="badge badge-success text-xs">{i.category}</span>
                  </td>
                  <td className="table-cell text-right font-semibold text-emerald-300">{inr(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
