import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function DebtsTab() {
  const { data: debts = [], isLoading } = useQuery({
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

  if (isLoading) return <div className="text-center py-12">Loading debts...</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-header">💳 Debts & Liabilities</h1>
      </div>
      
      {debts.map((monthData: any) => (
        <div key={monthData.month} className="card-lg">
          <button
            onClick={() => setExpandedMonth(expandedMonth === monthData.month ? null : monthData.month)}
            className="w-full text-left flex justify-between items-center group"
          >
            <div>
              <span className="text-2xl font-bold text-slate-50">{monthData.month}</span>
              <div className="text-sm text-slate-400 mt-1">Total: {inr(monthData.total)}</div>
            </div>
            <div className="text-3xl group-hover:scale-125 transition-transform">
              {expandedMonth === monthData.month ? '⬆️' : '⬇️'}
            </div>
          </button>

          {expandedMonth === monthData.month && (
            <div className="mt-6 space-y-3 pt-6 border-t border-slate-700">
              {monthData.creditors?.map((cred: any) => {
                const entry = monthData.entries[cred.id]
                if (!entry) return null
                
                const remaining = entry.amount - entry.amount_paid
                const progress = (entry.amount_paid / entry.amount) * 100

                return (
                  <div key={cred.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-700 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{cred.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Paid: {inr(entry.amount_paid)} / {inr(entry.amount)}
                        </div>
                      </div>
                      <div className={`badge ${
                        entry.status === 'paid' ? 'badge-paid' :
                        entry.status === 'partial' ? 'badge-partial' :
                        'badge-unpaid'
                      }`}>
                        {entry.status.toUpperCase()}
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-slate-600/50 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          entry.status === 'paid' ? 'bg-emerald-500' :
                          entry.status === 'partial' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-sm text-slate-300">
                        Remaining: <span className="font-bold text-red-300">{inr(remaining)}</span>
                      </span>
                      <button
                        onClick={() => setPaymentDialog(entry)}
                        className="btn-primary text-sm"
                      >
                        💰 Record Payment
                      </button>
                    </div>
                  </div>
                )
              })}
              
              <div className="mt-6 pt-6 border-t border-slate-700 space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Active Subscriptions:</span>
                  <span className="font-bold text-purple-300">{inr(monthData.subscriptions)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-slate-50">
                  <span>Total Liability:</span>
                  <span className="text-red-300">{inr(monthData.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Payment Dialog */}
      {paymentDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-sm w-full border border-slate-700 space-y-6 shadow-2xl">
            <div>
              <h2 className="text-2xl font-bold text-slate-50">💳 Record Payment</h2>
              <p className="text-slate-400 mt-2">Pay off your debt</p>
            </div>
            
            <div className="space-y-2 p-4 bg-slate-700/30 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Amount Owed:</span>
                <span className="font-bold text-red-300">{inr(paymentDialog.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Already Paid:</span>
                <span className="font-bold text-emerald-300">{inr(paymentDialog.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-600 pt-2 mt-2">
                <span className="text-slate-200">Remaining:</span>
                <span className="font-bold text-yellow-300">{inr(paymentDialog.amount - paymentDialog.amount_paid)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  payDebtMutation.mutate({ id: paymentDialog.id, full: true })
                  setPaymentDialog(null)
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:scale-105 transition-all"
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
              <button onClick={() => setPaymentDialog(null)} className="w-full btn-secondary">
                ✖️ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
