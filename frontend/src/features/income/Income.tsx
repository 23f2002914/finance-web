import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function IncomeTab() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['income'],
    queryFn: () => api('/income-entries'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div>Loading income...</div>

  const income = result?.data || []
  const total = income.reduce((sum: number, i: any) => sum + i.amount, 0)

  return (
    <div>
      <h1 className="section-header">Income</h1>
      <div className="card mb-4">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-2xl font-bold text-income">{inr(total)}</div>
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
            {income.slice(0, 20).map((i: any) => (
              <tr key={i.id} className="border-b">
                <td className="py-2">{i.date}</td>
                <td className="py-2">{i.description || '—'}</td>
                <td className="py-2">{i.category}</td>
                <td className="text-right py-2 font-semibold">{inr(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
