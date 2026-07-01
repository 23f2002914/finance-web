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
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  const alltime = dashboard.alltime || {}
  const monthly = dashboard.monthly || {}
  const totalBalance = Object.values(alltime).reduce((sum: number, acc: any) => sum + (acc.closing || 0), 0)
  const monthIncome = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.income || 0), 0)
  const monthExpenses = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.expenses || 0), 0)
  const monthSavings = monthIncome - monthExpenses

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-header">💰 Financial Dashboard</h1>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label">Total Balance</div>
          <div className="stat-value text-blue-400">{inr(totalBalance)}</div>
          <div className="text-xs text-slate-500 mt-2">All accounts combined</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value stat-income">{inr(monthIncome)}</div>
          <div className="text-xs text-slate-500 mt-2">This month</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Monthly Expenses</div>
          <div className="stat-value stat-expense">{inr(monthExpenses)}</div>
          <div className="text-xs text-slate-500 mt-2">This month</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Monthly Savings</div>
          <div className={`stat-value ${monthSavings >= 0 ? 'stat-save' : 'stat-expense'}`}>
            {inr(monthSavings)}
          </div>
          <div className="text-xs text-slate-500 mt-2">Income - Expenses</div>
        </div>
      </div>

      {/* Account Breakdown */}
      <div className="card-lg">
        <h2 className="text-xl font-bold mb-6 text-slate-50">🏦 Account Balances</h2>
        <div className="space-y-3">
          {dashboard.accounts?.map((acc: any) => {
            const balance = alltime[acc.name]?.closing || 0
            const type = acc.account_type
            return (
              <div key={acc.name} className="flex items-center justify-between p-4 bg-slate-700/20 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {type === 'Bank' ? '🏦' : type === 'Wallet' ? '👝' : '💵'}
                  </div>
                  <div>
                    <div className="font-semibold">{acc.name}</div>
                    <div className="text-xs text-slate-400">{type}</div>
                  </div>
                </div>
                <div className="font-bold text-lg text-blue-300">{inr(balance)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subscriptions & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-lg">
          <h3 className="text-lg font-bold mb-4 text-slate-50">📺 Active Subscriptions</h3>
          <div className="text-3xl font-bold text-purple-400">{inr(dashboard.subscription_total || 0)}</div>
          <div className="text-sm text-slate-400 mt-2">Monthly commitment</div>
        </div>

        <div className="card-lg">
          <h3 className="text-lg font-bold mb-4 text-slate-50">📊 Expense Categories</h3>
          <div className="space-y-2">
            {Object.entries(dashboard.expenses_by_category || {}).slice(0, 3).map(([cat, amt]: [string, any]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-300">{cat}</span>
                <span className="font-semibold text-orange-300">{inr(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
