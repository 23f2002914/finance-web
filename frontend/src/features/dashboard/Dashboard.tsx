import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { Skeleton } from '../components/Skeleton'

export function DashboardTab() {
  const { data: dashboard, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg shimmer w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load dashboard</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>
  if (!dashboard) return null

  const alltime: any = dashboard.alltime || {}
  const monthly: any = dashboard.monthly || {}
  const totalBalance = Object.values(alltime).reduce((s: number, a: any) => s + (a.closing || 0), 0)
  const monthIncome = Object.values(monthly).reduce((s: number, a: any) => s + (a.income || 0), 0)
  const monthExpenses = Object.values(monthly).reduce((s: number, a: any) => s + (a.expenses || 0), 0)
  const monthSavings = monthIncome - monthExpenses

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💰 Financial Dashboard</h1>
        <p className="text-sm text-slate-400">{dashboard.month} · at a glance</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Stat label="Total Balance" value={inr(totalBalance)} cls="from-cyan-300 to-cyan-200" sub="All accounts" hover />
        <Stat label="Monthly Income" value={inr(monthIncome)} cls="from-emerald-300 to-emerald-200" sub="This month" />
        <Stat label="Monthly Expenses" value={inr(monthExpenses)} cls="from-orange-300 to-orange-200" sub="This month" />
        <Stat label="Monthly Savings" value={inr(monthSavings)} cls={monthSavings >= 0 ? 'from-cyan-300 to-cyan-200' : 'from-red-300 to-red-200'} sub="Income − Expenses" />
      </div>

      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">🏦 Account Balances</h2>
        <div className="space-y-3">
          {dashboard.accounts?.map((acc: any) => {
            const balance = alltime[acc.name]?.closing || 0
            const icon = acc.account_type === 'Bank' ? '🏦' : acc.account_type === 'Wallet' ? '👝' : '💵'
            return (
              <div key={acc.name} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between group hover:bg-slate-800/60 hover:border-slate-600/60 transition-all">
                <div className="flex items-center gap-4">
                  <div className="text-3xl group-hover:scale-110 transition-transform">{icon}</div>
                  <div><div className="font-semibold text-slate-50">{acc.name}</div><div className="text-xs text-slate-500">{acc.account_type}</div></div>
                </div>
                <div className="text-right"><div className="font-bold text-lg text-cyan-300">{inr(balance)}</div><div className="text-xs text-slate-500">Balance</div></div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-4"><span className="text-3xl">📺</span><div><h3 className="text-2xl font-bold text-slate-100">Active Subscriptions</h3><p className="text-xs text-slate-500">Monthly commitment</p></div></div>
          <div className="text-3xl font-bold text-purple-300">{inr(dashboard.subscription_total || 0)}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-4"><span className="text-3xl">📊</span><div><h3 className="text-2xl font-bold text-slate-100">Top Spending</h3><p className="text-xs text-slate-500">By category</p></div></div>
          <div className="space-y-2">
            {Object.entries(dashboard.expenses_by_category || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([cat, amt]: [string, any]) => (
              <div key={cat} className="flex justify-between items-center py-2 px-3 hover:bg-slate-700/20 rounded"><span className="text-sm text-slate-300">{cat}</span><span className="font-semibold text-orange-300">{inr(amt)}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, cls, sub, hover }: any) {
  return (
    <div className={`bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 space-y-2 ${hover ? 'hover:scale-[1.03] transform transition-transform' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`text-3xl font-bold tracking-tight bg-gradient-to-r ${cls} bg-clip-text text-transparent`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  )
}
