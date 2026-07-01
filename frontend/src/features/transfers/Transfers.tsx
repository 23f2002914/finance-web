import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function TransfersTab() {
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => api('/transfers'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div className="text-center py-12">Loading transfers...</div>

  const total = transfers.reduce((sum: number, t: any) => sum + t.amount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-header">🔄 Transfers</h1>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Transferred</div>
        <div className="stat-value text-blue-400">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-2">{transfers.length} transfers</div>
      </div>

      {transfers.length === 0 ? (
        <div className="card-lg text-center py-12">
          <p className="text-slate-400">No transfers recorded yet</p>
        </div>
      ) : (
        <div className="card-lg overflow-x-auto">
          <h2 className="text-lg font-bold mb-4 text-slate-50">All Transfers</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">Date</th>
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">From</th>
                <th className="text-left py-3 px-4 text-slate-300 font-semibold">To</th>
                <th className="text-right py-3 px-4 text-slate-300 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.slice(0, 50).map((t: any, idx: number) => (
                <tr key={t.id || idx} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="py-3 px-4 text-slate-300">{t.date}</td>
                  <td className="py-3 px-4 text-slate-300 font-medium">{t.from_account}</td>
                  <td className="py-3 px-4 text-slate-300 font-medium">{t.to_account}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-300">{inr(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
