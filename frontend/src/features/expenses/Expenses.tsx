import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState, TableLoadingState } from '../components/LoadingState'

export function ExpensesTab() {
  const { data: result, isLoading, error } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api('/expenses'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load expenses</div>
  if (!result) return null

  const expenses = result?.data || []
  const total = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">💸 Expenses</h1>
        <p className="body-sm">Track your spending</p>
      </div>

      <div className="stat-card stat-card-expense">
        <div className="stat-label">Total Expenses</div>
        <div className="stat-value">{inr(total)}</div>
        <div className="stat-subtext">{expenses.length} transactions</div>
      </div>

      {expenses.length === 0 ? (
        <div className="surface-lg text-center py-16">
          <p className="text-slate-400 text-lg">No expenses recorded yet</p>
          <p className="caption mt-2">Your spending will appear here</p>
        </div>
      ) : (
        <div className="surface-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/30 hover:bg-slate-800/30">
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header">Category</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 50).map((e: any, idx: number) => (
                <tr key={e.id || idx} className="table-row">
                  <td className="table-cell text-slate-300">{e.date}</td>
                  <td className="table-cell text-slate-300">{e.description || '—'}</td>
                  <td className="table-cell">
                    <span className="badge badge-neutral text-xs">{e.category}</span>
                  </td>
                  <td className="table-cell text-right font-semibold text-orange-300">{inr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
