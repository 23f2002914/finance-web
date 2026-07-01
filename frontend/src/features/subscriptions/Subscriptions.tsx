import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function SubscriptionsTab() {
  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api('/subscriptions'),
    staleTime: 1000 * 60 * 5,
  })
  const queryClient = useQueryClient()
  const payMutation = useMutation({
    mutationFn: ({ id, cycle }: any) =>
      api(`/subscriptions/${id}/payments/${cycle}/pay`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  if (isLoading) return <div>Loading subscriptions...</div>

  const monthlyTotal = subs.reduce((sum: number, s: any) => sum + s.monthly_equiv, 0)
  const dueSubs = subs.filter((s: any) => s.current_cycle?.status === 'due')
  const paidSubs = subs.filter((s: any) => s.current_cycle?.status === 'paid')
  const overdueSubs = subs.filter((s: any) => s.current_cycle?.status === 'overdue')

  return (
    <div>
      <h1 className="section-header">Subscriptions</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-slate-600">Monthly Total</div>
          <div className="text-2xl font-bold mt-2">{inr(monthlyTotal)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Due This Month</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">{dueSubs.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Overdue</div>
          <div className="text-2xl font-bold text-expense mt-2">{overdueSubs.length}</div>
        </div>
      </div>

      {dueSubs.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-3">Due This Month</h2>
          <div className="space-y-2">
            {dueSubs.map((sub: any) => (
              <div key={sub.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                <div>
                  <div className="font-medium">{sub.name}</div>
                  <div className="text-sm text-slate-600">{inr(sub.amount)} • Due: {sub.current_cycle?.due_date}</div>
                </div>
                <button
                  onClick={() => payMutation.mutate({ id: sub.id, cycle: sub.current_cycle?.cycle_month })}
                  className="btn-primary text-sm"
                >
                  Mark Paid
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {overdueSubs.length > 0 && (
        <div className="card mb-6 border-l-4 border-expense">
          <h2 className="font-semibold mb-3 text-expense">Overdue</h2>
          <div className="space-y-2">
            {overdueSubs.map((sub: any) => (
              <div key={sub.id} className="text-sm text-expense">
                {sub.name} - {inr(sub.amount)} (due {sub.current_cycle?.due_date})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">All Subscriptions</h2>
        <div className="space-y-3">
          {subs.map((sub: any) => (
            <div key={sub.id} className="flex justify-between items-start p-3 bg-slate-50 dark:bg-slate-800 rounded">
              <div>
                <div className="font-medium">{sub.name}</div>
                <div className="text-sm text-slate-600">{sub.description}</div>
                <div className="text-sm mt-1">
                  {inr(sub.amount)} / {sub.billing_cycle} • Day {sub.billing_day}
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-sm font-medium ${
                sub.current_cycle?.status === 'paid' ? 'bg-income/20 text-income' :
                sub.current_cycle?.status === 'overdue' ? 'bg-expense/20 text-expense' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {sub.current_cycle?.status?.toUpperCase() || 'DUE'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
