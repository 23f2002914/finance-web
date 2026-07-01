import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function AccountsTab() {
  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api('/accounts'),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load accounts</div>

  const total = accounts.reduce((sum: number, a: any) => sum + a.closing_balance, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">🏦 Bank Accounts</h1>
        <p className="body-sm">Manage your accounts</p>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Balance</div>
        <div className="stat-value text-cyan-300">{inr(total)}</div>
        <div className="stat-subtext">{accounts.length} accounts</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account: any) => {
          const icon = account.account_type === 'Bank' ? '🏦' : account.account_type === 'Wallet' ? '👝' : '💵'
          return (
            <div key={account.id} className="surface-lg p-6 hover:scale-105 transform transition-transform">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{icon}</span>
                    <div>
                      <h3 className="h4 text-slate-50">{account.name}</h3>
                      <p className="caption">{account.account_type}</p>
                    </div>
                  </div>
                </div>
                <span className={`badge ${account.active ? 'badge-success' : 'badge-neutral'}`}>
                  {account.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="border-t border-slate-700/50 pt-4">
                <p className="label mb-2">Closing Balance</p>
                <p className="text-2xl font-bold text-cyan-300">{inr(account.closing_balance)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
