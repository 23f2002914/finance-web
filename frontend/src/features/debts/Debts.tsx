import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function DebtsTab() {
  const { data: debts = [], isLoading, error } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api('/debts'),
    staleTime: 1000 * 60 * 5,
  })
  const queryClient = useQueryClient()
  const payDebtMutation = useMutation({
    mutationFn: ({ id, amount, full }: any) =>
      api(`/debts/${id}/pay`, { method: 'POST', body: { amount_paid: amount, full } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  })

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [paymentDialog, setPaymentDialog] = useState<any>(null)

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load debts</div>

  const totalDebt = debts.reduce((sum: number, m: any) => sum + (m.total || 0), 0)
  const paidCount = debts.reduce((count: number, m: any) => {
    return count + Object.values(m.entries || {}).filter((e: any) => e.status === 'paid').length
  }, 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">💳 Debts & Liabilities</h1>
        <p className="body-sm">Track what you owe</p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card stat-card-debt">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value">{inr(totalDebt)}</div>
          <div className="stat-subtext">{debts.length} months</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-label">Paid</div>
          <div className="stat-value">{paidCount}</div>
          <div className="stat-subtext">Entries fully paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Subscriptions</div>
          <div className="stat-value text-purple-300">
            {inr(debts.reduce((sum: number, m: any) => sum + (m.subscriptions || 0), 0))}
          </div>
          <div className="stat-subtext">Monthly commitment</div>
        </div>
      </div>

      {/* Monthly Debt Cards */}
      {debts.length === 0 ? (
        <div className="surface-lg text-center py-16">
          <p className="text-slate-400 text-lg">No debts recorded</p>
          <p className="caption mt-2">Great job staying debt-free! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {debts.map((monthData: any) => (
            <div key={monthData.month} className="surface-lg overflow-hidden">
              <button
                onClick={() => setExpandedMonth(expandedMonth === monthData.month ? null : monthData.month)}
                className="w-full p-6 text-left flex justify-between items-center hover:bg-slate-700/20 transition-colors group"
              >
                <div>
                  <h3 className="h3 text-slate-50 group-hover:text-slate-100">{monthData.month}</h3>
                  <p className="caption mt-1">Total: {inr(monthData.total)}</p>
                </div>
                <div className="text-2xl group-hover:scale-110 transition-transform">
                  {expandedMonth === monthData.month ? '⬆️' : '⬇️'}
                </div>
              </button>

              {expandedMonth === monthData.month && (
                <>
                  <div className="border-t border-slate-700/50" />
                  <div className="p-6 space-y-4">
                    {monthData.creditors?.map((cred: any) => {
                      const entry = monthData.entries[cred.id]
                      if (!entry) return null
                      
                      const remaining = entry.amount - entry.amount_paid
                      const progress = (entry.amount_paid / entry.amount) * 100
                      
                      const statusBadge = entry.status === 'paid' 
                        ? 'badge-success'
                        : entry.status === 'partial' 
                        ? 'badge-warning'
                        : 'badge-danger'

                      return (
                        <div key={cred.id} className="surface p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="h4 text-slate-50">{cred.name}</h4>
                              <p className="caption mt-1">
                                Paid: {inr(entry.amount_paid)} / {inr(entry.amount)}
                              </p>
                            </div>
                            <span className={`badge ${statusBadge} text-xs font-bold`}>
                              {entry.status.toUpperCase()}
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                entry.status === 'paid' ? 'bg-emerald-500' :
                                entry.status === 'partial' ? 'bg-amber-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center pt-2">
                            <span className="body-sm text-slate-300">
                              Remaining: <span className="font-bold text-red-300">{inr(remaining)}</span>
                            </span>
                            {entry.status !== 'paid' && (
                              <button
                                onClick={() => setPaymentDialog(entry)}
                                className="btn-sm btn-primary"
                              >
                                💰 Pay
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      {paymentDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-lg p-8 max-w-sm w-full space-y-6 rounded-2xl">
            <div>
              <h2 className="h3 text-slate-50">💳 Record Payment</h2>
              <p className="caption mt-2">Pay off your debt</p>
            </div>
            
            <div className="surface p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="label text-slate-300">Amount Owed:</span>
                <span className="font-bold text-red-300">{inr(paymentDialog.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="label text-slate-300">Already Paid:</span>
                <span className="font-bold text-emerald-300">{inr(paymentDialog.amount_paid)}</span>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between text-sm">
                <span className="label text-slate-200">Remaining:</span>
                <span className="font-bold text-yellow-300">{inr(paymentDialog.amount - paymentDialog.amount_paid)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  payDebtMutation.mutate({ id: paymentDialog.id, full: true })
                  setPaymentDialog(null)
                }}
                className="w-full btn-primary"
              >
                ✅ Mark Fully Paid
              </button>
              <button
                onClick={() => {
                  const amount = prompt('Enter payment amount:')
                  if (amount) {
                    payDebtMutation.mutate({ id: paymentDialog.id, amount: parseFloat(amount) })
                    setPaymentDialog(null)
                  }
                }}
                className="w-full btn-secondary"
              >
                💰 Record Partial Payment
              </button>
              <button onClick={() => setPaymentDialog(null)} className="w-full btn-ghost">
                ✖️ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
