import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function TransfersTab() {
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => api('/transfers'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div>Loading transfers...</div>

  const total = transfers.reduce((sum: number, t: any) => sum + t.amount, 0)

  return (
    <div>
      <h1 className="section-header">Transfers</h1>
      <div className="card mb-4">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-2xl font-bold text-transfer">{inr(total)}</div>
      </div>
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">From</th>
              <th className="text-left py-2">To</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.slice(0, 20).map((t: any) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.date}</td>
                <td className="py-2">{t.from_account}</td>
                <td className="py-2">{t.to_account}</td>
                <td className="text-right py-2 font-semibold">{inr(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
