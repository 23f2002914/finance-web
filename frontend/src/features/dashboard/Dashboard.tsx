import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function DashboardTab() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading || !dashboard) {
    return <div>Loading dashboard...</div>
  }

  const alltime = dashboard.alltime || {}
  const monthly = dashboard.monthly || {}
  const totalBalance = Object.values(alltime).reduce((sum: number, acc: any) => sum + (acc.closing || 0), 0)
  const monthIncome = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.income || 0), 0)
  const monthExpenses = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.expenses || 0), 0)
  const monthSavings = monthIncome - monthExpenses

  return (
    <div>
      <h1 className="section-header">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-sm text-slate-600">Total Balance</div>
          <div className="text-2xl font-bold mt-2">{inr(totalBalance)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">This Month Income</div>
          <div className="text-2xl font-bold text-income mt-2">{inr(monthIncome)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">This Month Expenses</div>
          <div className="text-2xl font-bold text-expense mt-2">{inr(monthExpenses)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-600">Monthly Savings</div>
          <div className={`text-2xl font-bold mt-2 ${monthSavings >= 0 ? 'text-income' : 'text-expense'}`}>
            {inr(monthSavings)}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Account Balances</h2>
        <div className="space-y-2">
          {dashboard.accounts?.map((acc: any) => (
            <div key={acc.name} className="flex justify-between items-center">
              <span>{acc.name}</span>
              <span className="font-semibold">{inr(alltime[acc.name]?.closing || 0)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-4">Subscriptions This Month</h2>
        <div className="text-2xl font-bold text-subscription">{inr(dashboard.subscription_total || 0)}</div>
      </div>
    </div>
  )
}
