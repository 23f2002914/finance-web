import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function SubscriptionsTab() {
  const { data: subscriptions = [], isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api('/subscriptions'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load subscriptions</div>

  const total = subscriptions.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">📺 Subscriptions</h1>
        <p className="body-sm">Recurring payments</p>
      </div>

      <div className="stat-card">
        <div className="stat-label">Monthly Total</div>
        <div className="stat-value text-purple-300">{inr(total)}</div>
        <div className="stat-subtext">{subscriptions.length} active subscriptions</div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="surface-lg text-center py-16">
          <p className="text-slate-400 text-lg">No subscriptions yet</p>
          <p className="caption mt-2">Add your recurring payments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((sub: any) => (
            <div key={sub.id} className="surface-lg p-6 hover:scale-105 transform transition-transform">
              <div className="flex items-start justify-between mb-4">
                <h3 className="h4 text-slate-50">{sub.name}</h3>
                <span className="badge badge-info text-xs">{sub.billing_cycle}</span>
              </div>
              <p className="body-sm text-slate-300 mb-4">{sub.description || 'No description'}</p>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="label mb-2">Monthly Cost</p>
                <p className="text-2xl font-bold text-purple-300">{inr(sub.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
