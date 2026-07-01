import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function ExpensesTab() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api('/expenses'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div>Loading expenses...</div>

  const expenses = result?.data || []
  const total = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)

  return (
    <div>
      <h1 className="section-header">Expenses</h1>
      <div className="card mb-4">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-2xl font-bold text-expense">{inr(total)}</div>
      </div>
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Description</th>
              <th className="text-left py-2">Category</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.slice(0, 20).map((e: any) => (
              <tr key={e.id} className="border-b">
                <td className="py-2">{e.date}</td>
                <td className="py-2">{e.description || '—'}</td>
                <td className="py-2">{e.category}</td>
                <td className="text-right py-2 font-semibold">{inr(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
