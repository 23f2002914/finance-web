import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function TransfersTab() {
  const { data: transfers = [], isLoading, error } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => api('/transfers'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load transfers</div>

  const total = transfers.reduce((sum: number, t: any) => sum + t.amount, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">🔄 Transfers</h1>
        <p className="body-sm">Between your accounts</p>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Transferred</div>
        <div className="stat-value text-cyan-300">{inr(total)}</div>
        <div className="stat-subtext">{transfers.length} transfers</div>
      </div>

      {transfers.length === 0 ? (
        <div className="surface-lg text-center py-16">
          <p className="text-slate-400 text-lg">No transfers recorded yet</p>
          <p className="caption mt-2">Your transfers will appear here</p>
        </div>
      ) : (
        <div className="surface-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/30">
                <th className="table-header">Date</th>
                <th className="table-header">From</th>
                <th className="table-header">To</th>
                <th className="table-header text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfers.slice(0, 50).map((t: any, idx: number) => (
                <tr key={t.id || idx} className="table-row">
                  <td className="table-cell text-slate-300">{t.date}</td>
                  <td className="table-cell text-slate-300 font-medium">{t.from_account}</td>
                  <td className="table-cell text-slate-300 font-medium">{t.to_account}</td>
                  <td className="table-cell text-right font-semibold text-blue-300">{inr(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
