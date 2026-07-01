import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function AccountsTab() {
  const { data: accounts = [], isLoading, error } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>

  const total = accounts.reduce((s: number, a: any) => s + Number(a.closing_balance), 0)
  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">🏦 Bank Accounts</h1>
        <p className="text-sm text-slate-400">Your accounts and balances</p>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Balance</div>
        <div className="text-3xl font-bold text-cyan-300">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{accounts.length} accounts</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((a: any) => {
          const icon = a.account_type === 'Bank' ? '🏦' : a.account_type === 'Wallet' ? '👝' : '💵'
          return (
            <div key={a.id} className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-6 hover:scale-[1.02] transform transition-transform">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-50">{a.name}</h3>
                    <p className="text-xs text-slate-500">{a.account_type}</p>
                  </div>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${a.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/40 text-slate-300'}`}>{a.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Closing Balance</p>
                <p className="text-2xl font-bold text-cyan-300">{inr(Number(a.closing_balance))}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
