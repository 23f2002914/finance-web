import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { Skeleton } from '../components/Skeleton'

export function DashboardTab() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg shimmer w-1/3" />
        <div className="grid-responsive">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  const alltime = dashboard.alltime || {}
  const monthly = dashboard.monthly || {}
  const totalBalance = Object.values(alltime).reduce((sum: number, acc: any) => sum + (acc.closing || 0), 0)
  const monthIncome = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.income || 0), 0)
  const monthExpenses = Object.values(monthly).reduce((sum: number, acc: any) => sum + (acc.expenses || 0), 0)
  const monthSavings = monthIncome - monthExpenses

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">💰 Financial Dashboard</h1>
        <p className="body-sm">Track your finances at a glance</p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid-responsive">
        <div className="stat-card stat-card-save hover:scale-105 transform transition-transform">
          <div className="stat-label">Total Balance</div>
          <div className="stat-value">{inr(totalBalance)}</div>
          <div className="stat-subtext">All accounts</div>
        </div>
        
        <div className="stat-card stat-card-income">
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value">{inr(monthIncome)}</div>
          <div className="stat-subtext">This month</div>
        </div>
        
        <div className="stat-card stat-card-expense">
          <div className="stat-label">Monthly Expenses</div>
          <div className="stat-value">{inr(monthExpenses)}</div>
          <div className="stat-subtext">This month</div>
        </div>
        
        <div className={`stat-card ${monthSavings >= 0 ? 'stat-card-save' : 'stat-card-expense'}`}>
          <div className="stat-label">Monthly Savings</div>
          <div className="stat-value">{inr(monthSavings)}</div>
          <div className="stat-subtext">Income - Expenses</div>
        </div>
      </div>

      {/* Account Breakdown */}
      <div className="surface-lg p-8 space-y-6">
        <h2 className="section-subheader">🏦 Account Balances</h2>
        <div className="space-y-3">
          {dashboard.accounts?.map((acc: any) => {
            const balance = alltime[acc.name]?.closing || 0
            const type = acc.account_type
            const icon = type === 'Bank' ? '🏦' : type === 'Wallet' ? '👝' : '💵'
            
            return (
              <div key={acc.name} className="surface-interactive p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="text-3xl group-hover:scale-110 transition-transform">{icon}</div>
                  <div>
                    <div className="font-semibold text-slate-50">{acc.name}</div>
                    <div className="caption">{type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-cyan-300">{inr(balance)}</div>
                  <div className="caption">Balance</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subscriptions & Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="surface-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📺</span>
            <div>
              <h3 className="section-subheader m-0">Active Subscriptions</h3>
              <p className="caption">Monthly commitment</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-purple-300">{inr(dashboard.subscription_total || 0)}</div>
        </div>

        <div className="surface-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📊</span>
            <div>
              <h3 className="section-subheader m-0">Top Spending</h3>
              <p className="caption">By category</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(dashboard.expenses_by_category || {})
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 3)
              .map(([cat, amt]: [string, any]) => (
                <div key={cat} className="flex justify-between items-center py-2 px-3 hover:bg-slate-700/20 rounded">
                  <span className="body-sm text-slate-300">{cat}</span>
                  <span className="font-semibold text-orange-300">{inr(amt)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
